ΣΤΟΧΟΣ — ΕΓΚΑΤΑΣΤΑΣΗ / ΔΟΚΙΜΕΣ (15/11/2026)

1. ΚΡΑΤΗΣΕ ΑΝΤΙΓΡΑΦΟ ΑΣΦΑΛΕΙΑΣ
   Φύλαξε το προηγούμενο ZIP και, πριν από αλλαγές δεδομένων,
   εξήγαγε αντίγραφο Firestore με τον κατάλληλο τρόπο για το project.

2. ΤΟΠΙΚΗ ΔΟΚΙΜΗ FRONTEND
   Άνοιξε τον κύριο φάκελο σε VS Code > Live Server (localhost).
   Στο Firebase Authentication > Settings > Authorized domains πρέπει
   να επιτρέπεται το τοπικό domain που χρησιμοποιείς.
   Τα index.html, script.js, firebase-auth.js, style.css πρέπει να
   παραμείνουν στον κύριο φάκελο, με τις υπάρχουσες τράπεζες ερωτήσεων.

3. FIREBASE FUNCTIONS
   Προϋποθέσεις: Node.js 22, Firebase CLI, Firebase project stoxos-asep
   στο πρόγραμμα Blaze. Οι Functions βρίσκονται στην europe-west1.
   Από τον κύριο φάκελο:
     firebase login
     firebase use stoxos-asep
     cd functions
     npm ci
     npm run check
     cd ..
     firebase deploy --only functions
   Η μεταφορά του code στο cloud είναι απαραίτητη μόνο αν άλλαξε ο
   φάκελος functions. Οι κωδικοί Stripe ανήκουν σε Firebase Secrets:
     STRIPE_SECRET_KEY
     STRIPE_WEBHOOK_SECRET
   Δεν αποθηκεύονται σε JS, HTML, README ή στο Git.
   Μη μεταβαίνεις σε Live Stripe keys πριν τον έλεγχο παραγωγής.

4. FIRESTORE RULES
   Οι κανόνες είναι στο firestore.rules. Αν τροποποιηθούν,
   έλεγξέ τους και δημοσίευσέ τους με:
     firebase deploy --only firestore:rules
   Οι κανόνες δεν παρακάμπτονται από την οθόνη του browser.

5. ΔΗΜΟΣΙΕΥΣΗ FRONTEND
   Για τον συνδεδεμένο ιστότοπο Netlify: commit + push στο GitHub.
   Για αρχική τοπική δοκιμή frontend δεν απαιτείται commit/push.
   Το firebase deploy και το GitHub/Netlify deploy είναι ανεξάρτητα.

6. ΒΑΣΙΚΟ CHECKLIST
   - Δοκίμασε Google login / logout με διαφορετικούς λογαριασμούς.
   - Δοκίμασε εκμάθηση με «Όλες οι κατηγορίες», έξοδο και «Συνέχεια».
   - Ολοκλήρωσε τεστ και έλεγξε ότι δεν δημιουργούνται διπλά events.
   - Δοκίμασε δωρεάν όριο 5 ολοκληρωμένων τεστ.
   - Σε Premium: βεβαιώσου ότι το «Το πακέτο μου» εμφανίζει σωστό
     πακέτο, ημερομηνία λήξης/ανανέωσης και Stripe Portal.
   - Με ακύρωση στο Stripe Sandbox, η συνδρομή να δείχνει μη
     αυτόματη ανανέωση και να λήγει στη σωστή ημερομηνία.
   - Έλεγξε την εμφάνιση σε desktop και κινητό.

ΠΡΟΣΟΧΗ
- Firebase Functions μπορεί να δημιουργήσουν χρεώσεις στο Blaze.
- Ερωτήσεις και βαθμολογίες προέρχονται από client-side κώδικα.
- Τα test Stripe Price IDs αντιστοιχούν μόνο στο Sandbox account.
- Δεν έχουν προστεθεί πραγματικές χρεώσεις ή ολοκληρωθεί τα
  σενάρια refunds/disputes/failed renewals για Live Mode.
