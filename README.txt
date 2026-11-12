ΣΤΟΧΟΣ — Βήμα 2: Firebase Cloud Functions (ασφαλής βάση, χωρίς πληρωμές)

ΠΕΡΙΕΧΟΜΕΝΑ
firebase.json
functions/package.json
functions/index.txt  (μετονόμασέ το σε index.js πριν από την εγκατάσταση)

ΑΠΑΙΤΗΣΕΙΣ
- Node.js 22 και Firebase CLI στον υπολογιστή.
- Firebase project: stoxos-asep, με Blaze.
- Αποθήκευσε αυτά τα αρχεία στον κύριο φάκελο του project, με τη δομή που φαίνεται παραπάνω.
- Μην αντικαταστήσεις τυχόν υπάρχον firebase.json χωρίς να ελέγξουμε πρώτα τη συγχώνευση ρυθμίσεων.

ΕΝΤΟΛΕΣ (από τον κύριο φάκελο project)
  npm install -g firebase-tools
  firebase login
  firebase use stoxos-asep
  cd functions
  npm install
  npm run check
  cd ..
  firebase deploy --only functions:billing

ΤΙ ΚΑΝΕΙ
- Δημοσιεύει την callable function getSubscriptionStatus στην περιοχή europe-west1.
- Απαιτεί Firebase Authentication.
- Διαβάζει μόνο τη δική του συνδρομή (UID από verified Firebase token).
- Δεν δημιουργεί συνδρομές, δεν γράφει στο Firestore, δεν χρεώνει χρήστες.
- Το Premium συνεχίζει να ελέγχεται από την υπάρχουσα συλλογή entitlements.

ΠΡΙΝ ΑΠΟ ΠΡΑΓΜΑΤΙΚΕΣ ΠΛΗΡΩΜΕΣ
Χρειάζονται Stripe test keys/prices, Google Play setup, webhooks, έλεγχοι
συνδρομών, προστασία idempotency, ακυρώσεις, επιστροφές, App Check,
Firestore emulator tests και έλεγχος τιμολόγησης/νομικών όρων.

ΠΡΟΣΟΧΗ: Η εγκατάσταση Cloud Functions ενδέχεται να δημιουργήσει χρεώσεις
στο Blaze. Οι ειδοποιήσεις budget δεν αποτελούν hard spending cap.
