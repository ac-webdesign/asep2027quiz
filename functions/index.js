'use strict';

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const Stripe = require('stripe');

initializeApp();
const db = getFirestore();
const stripeKey = defineSecret('STRIPE_SECRET_KEY');
const webhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const REGION = 'europe-west1';
const SITE = 'https://asep2027quiz.netlify.app';
const PRICES = Object.freeze({
  monthly: 'price_1UbKzKCfhNL4A4NwSvDIHYSs',
  yearly: 'price_1UbL2HCfhNL4A4NwvDMKV5c4',
});
const stripe = () => new Stripe(stripeKey.value());
const callableOptions = { region: REGION, enforceAppCheck: false, maxInstances: 3, secrets: [stripeKey] };

exports.getSubscriptionStatus = onCall(
  { region: REGION, enforceAppCheck: false, maxInstances: 3 },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Απαιτείται σύνδεση Google.');
    const uid = request.auth.uid;
    const [subDoc, entitlementDoc] = await Promise.all([
      db.collection('subscriptions').doc(uid).get(),
      db.collection('entitlements').doc(uid).get(),
    ]);
    const sub = subDoc.exists ? subDoc.data() : null;
    return {
      premium: entitlementDoc.exists && entitlementDoc.get('premium') === true,
      plan: typeof sub?.plan === 'string' ? sub.plan : null,
      status: typeof sub?.status === 'string' ? sub.status : 'none',
      provider: ['stripe', 'google_play'].includes(sub?.provider) ? sub.provider : null,
      currentPeriodEnd: sub?.currentPeriodEnd?.toMillis?.() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd === true,
    };
  }
);

async function getOrCreateCustomer(uid, email) {
  const customerRef = db.collection('billingCustomers').doc(uid);
  const saved = await customerRef.get();
  if (saved.exists && typeof saved.get('stripeCustomerId') === 'string') {
    return saved.get('stripeCustomerId');
  }
  const client = stripe();
  // Stable idempotency key protects retries while the customer mapping is being saved.
  const customer = await client.customers.create(
    { email: email || undefined, metadata: { firebaseUid: uid } },
    { idempotencyKey: `stoxos-customer-${uid}` }
  );
  await customerRef.set({ stripeCustomerId: customer.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return customer.id;
}

exports.createStripeCheckout = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Απαιτείται σύνδεση Google.');
  const plan = request.data?.plan;
  if (!Object.hasOwn(PRICES, plan)) throw new HttpsError('invalid-argument', 'Μη έγκυρο πακέτο.');
  const uid = request.auth.uid;
  const existing = await db.collection('subscriptions').doc(uid).get();
  if (existing.exists && existing.get('provider') === 'stripe' &&
      ['active', 'trialing', 'past_due'].includes(existing.get('status'))) {
    throw new HttpsError('failed-precondition', 'Υπάρχει ήδη συνδρομή. Χρησιμοποίησε τη διαχείριση συνδρομής.');
  }
  const customerId = await getOrCreateCustomer(uid, request.auth.token.email);
  try {
    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      client_reference_id: uid,
      subscription_data: { metadata: { firebaseUid: uid, plan } },
      metadata: { firebaseUid: uid, plan },
      success_url: `${SITE}/?checkout=success`,
      cancel_url: `${SITE}/?checkout=cancel`,
      allow_promotion_codes: false,
    });
    return { url: session.url };
  } catch (error) {
    console.error('Stripe Checkout error', error?.type || error?.code || 'unknown');
    throw new HttpsError('internal', 'Δεν ήταν δυνατή η έναρξη της πληρωμής.');
  }
});

exports.createStripePortal = onCall(callableOptions, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Απαιτείται σύνδεση Google.');
  const saved = await db.collection('billingCustomers').doc(request.auth.uid).get();
  const customerId = saved.get('stripeCustomerId');
  if (!customerId) throw new HttpsError('failed-precondition', 'Δεν βρέθηκε λογαριασμός χρέωσης.');
  try {
    const session = await stripe().billingPortal.sessions.create({ customer: customerId, return_url: `${SITE}/` });
    return { url: session.url };
  } catch (error) {
    console.error('Stripe Portal error', error?.type || error?.code || 'unknown');
    throw new HttpsError('internal', 'Δεν ήταν δυνατό το άνοιγμα διαχείρισης συνδρομής.');
  }
});

async function syncSubscription(client, subscriptionId) {
  // Retrieve current Stripe state rather than trusting out-of-order webhook payloads.
  const subscription = await client.subscriptions.retrieve(subscriptionId);
  const uid = subscription.metadata?.firebaseUid;
  if (!uid || uid.includes('/')) throw new Error('Subscription has no trusted Firebase UID metadata');
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const customer = await db.collection('billingCustomers').doc(uid).get();
  if (!customer.exists || customer.get('stripeCustomerId') !== customerId) {
    throw new Error('Customer/UID mismatch');
  }
  const priceId = subscription.items.data[0]?.price?.id;
  const plan = Object.keys(PRICES).find((key) => PRICES[key] === priceId);
  if (!plan) throw new Error('Unexpected Stripe price');
  const status = subscription.status;
  const premium = status === 'active' || status === 'trialing';
  const periodEnd = subscription.items.data[0]?.current_period_end ?? subscription.current_period_end;
  const subRef = db.collection('subscriptions').doc(uid);
  const entitlementRef = db.collection('entitlements').doc(uid);
  await db.runTransaction(async (tx) => {
    const [previous, entitlement] = await Promise.all([tx.get(subRef), tx.get(entitlementRef)]);
    // A delayed event from an older subscription must not revoke a newer subscription.
    if (previous.exists && previous.get('provider') === 'stripe' &&
        previous.get('stripeSubscriptionId') !== subscription.id &&
        ['active', 'trialing'].includes(previous.get('status'))) return;
    tx.set(subRef, {
      provider: 'stripe', plan, status, stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId, cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
      currentPeriodEnd: periodEnd ? Timestamp.fromMillis(periodEnd * 1000) : null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    // Preserve independently granted premium; do not override Google Play entitlements.
    if (previous.exists && previous.get('provider') === 'google_play') return;
    if (entitlement.exists && entitlement.get('source') && entitlement.get('source') !== 'stripe') return;
    tx.set(entitlementRef, { premium, source: 'stripe', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

exports.stripeWebhook = onRequest(
  { region: REGION, maxInstances: 3, secrets: [stripeKey, webhookSecret] },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
    let event;
    try {
      event = stripe().webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], webhookSecret.value());
    } catch (error) {
      console.error('Stripe webhook signature rejected');
      res.status(400).send('Invalid signature'); return;
    }
    const types = new Set([
      'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
      'checkout.session.completed', 'checkout.session.async_payment_succeeded',
    ]);
    if (!types.has(event.type)) { res.status(200).send('Ignored'); return; }
    const eventRef = db.collection('billingEvents').doc(event.id);
    try {
      if ((await eventRef.get()).exists) { res.status(200).send('Already processed'); return; }
      let subscriptionId;
      if (event.type.startsWith('customer.subscription.')) subscriptionId = event.data.object.id;
      else subscriptionId = event.data.object.subscription;
      if (typeof subscriptionId !== 'string') throw new Error('Missing subscription ID');
      await syncSubscription(stripe(), subscriptionId);
      await eventRef.create({ type: event.type, processedAt: FieldValue.serverTimestamp() });
      res.status(200).send('OK');
    } catch (error) {
      // Retryable: do not mark event processed on failure.
      if (error.code === 6) { res.status(200).send('Already processed'); return; }
      console.error('Stripe webhook processing failed', event.type, error?.message);
      res.status(500).send('Retry later');
    }
  }
);
