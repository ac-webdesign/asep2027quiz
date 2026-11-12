'use strict';

// STOXOS - Firebase Functions (2nd generation)
// Στάδιο 2: ασφαλής, μόνο-για-ανάγνωση έλεγχος συνδρομής.
// Δεν πραγματοποιεί χρεώσεις ούτε απονέμει Premium.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

exports.getSubscriptionStatus = onCall(
  { region: 'europe-west1', enforceAppCheck: false, maxInstances: 3 },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'Απαιτείται σύνδεση Google.');
    }
    const uid = request.auth.uid;
    const [subscription, entitlement] = await Promise.all([
      db.collection('subscriptions').doc(uid).get(),
      db.collection('entitlements').doc(uid).get(),
    ]);
    const sub = subscription.exists ? subscription.data() : null;
    const legacyPremium = entitlement.exists && entitlement.get('premium') === true;
    // ΠΡΟΣΟΧΗ: το legacy entitlement παραμένει ο μηχανισμός πρόσβασης του web app.
    // Το status εδώ είναι πληροφοριακό, όχι επιβεβαίωση πληρωμής.
    return {
      premium: legacyPremium,
      plan: sub && typeof sub.plan === 'string' ? sub.plan : null,
      status: sub && typeof sub.status === 'string' ? sub.status : 'none',
      provider: sub && ['stripe', 'google_play'].includes(sub.provider) ? sub.provider : null,
      currentPeriodEnd: sub && sub.currentPeriodEnd && typeof sub.currentPeriodEnd.toMillis === 'function'
        ? sub.currentPeriodEnd.toMillis() : null,
    };
  }
);
