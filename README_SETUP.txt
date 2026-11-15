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

7. ΦΑΣΗ 1 — ΝΕΑ ΡΥΘΜΙΣΗ ΔΙΑΓΡΑΦΗΣ ΛΟΓΑΡΙΑΣΜΟΥ
   Αρχεία που αντικαθιστάς: index.html, script.js, firebase-auth.js,
   style.css, functions/index.js, firestore.rules, firebase.json,
   README.txt και README_SETUP.txt.
   ΝΕΑ αρχεία στον κύριο φάκελο: privacy.html, terms.html,
   support.html, delete-account.html, delete-account-page.js.

   Πριν από δοκιμή της ΔΙΑΓΡΑΦΗΣ:
     α) Πάρε αντίγραφο ασφαλείας του project και βεβαιώσου ότι
        είσαι συνδεδεμένος στο σωστό Firebase project stoxos-asep.
     β) Μετά την αντικατάσταση, από τον ΡΙΖΙΚΟ φάκελο ASEP εκτέλεσε:
          firebase deploy --only functions,firestore:rules
        (Το firebase.json περιλαμβάνει πια και το firestore.rules.)
     γ) Για Netlify απαιτείται ξεχωριστό commit + push. Οι δημόσιες
        σελίδες δεν εμφανίζονται στον online ιστότοπο χωρίς αυτό.
     δ) Άνοιξε https://asep2027quiz.netlify.app/delete-account.html
        μόνο αφού δημοσιευτούν τα αρχεία και δοκίμασε με ΝΕΟ Google
        account χωρίς σημαντικά δεδομένα και χωρίς κανονική πληρωμή.
     ε) Έλεγξε Firebase Authentication > Users ότι ο account έφυγε,
        Firestore users/{uid} και υποσυλλογές ότι διαγράφηκαν,
        entitlements/subscriptions/billingCustomers/{uid} ότι λείπουν.
        Για Stripe Sandbox έλεγξε ότι ο customer είναι deleted και
        η συνδρομή cancelled.

8. FIRESTORE TTL (υποχρεωτικό πριν από παραγωγή)
   Στην Firebase Console -> Firestore -> Time-to-live:
   Πρόσθεσε πολιτική TTL για collection group "accountDeletionLocks",
   timestamp field "expiresAt". Η λειτουργία κρατά περιορισμένο
   δείκτη UID έως 7 ημέρες για να μην επανενεργοποιείται το account
   από καθυστερημένα events / παλιά JWT. Χωρίς αυτή τη ρύθμιση ο
   δείκτης ΔΕΝ θα διαγράφεται αυτόματα.
   Δεν απαιτείται νέο Firebase Functions secret.

9. ΠΡΟΣΟΧΗ ΠΡΙΝ ΑΠΟ GOOGLE PLAY / LIVE PAYMENTS
   - Ο υπεύθυνος επεξεργασίας ΔΕΝ έχει οριστεί.
   - Το email υποστήριξης ΔΕΝ έχει οριστεί.
   - Τα privacy.html/terms.html είναι σημασμένα ως ΠΡΟΣΧΕΔΙΑ και
     έχουν noindex. Δεν αποτελούν τελικές νομικές δηλώσεις.
   - Η δημόσια διαγραφή απαιτεί Google account. Χρειάζεται επιπλέον
     τρόπος επικοινωνίας για όποιον έχασε πρόσβαση σε αυτόν.
   - Η λειτουργία διαγραφής Google Play subscriptions δεν υπάρχει
     ακόμη. Χρειάζεται εφαρμογή Play Billing και server validation.
   - Οι δοκιμές backend έγιναν με προσομοιώσεις, όχι με πραγματική
     διαγραφή στο live Firebase. Κάνε τα βήματα του 7 πριν δημοσίευση.
