// Πρόγραμμα εξάσκησης ΑΣΕΠ.
// Το BANK περιέχει τις ερωτήσεις από το αρχείο questions.js.

const QUESTIONS_PER_TEST = 25;
const ANSWER_LETTERS = ["Α", "Β", "Γ", "Δ"];
const app = document.getElementById("app");

// Δεδομένα για τη λειτουργία Τεστ.
let test = [];
let answers = [];
let position = 0;
let knowledgeResultLogged = false;

// Δεδομένα για τη λειτουργία Εκμάθησης.
let studyQuestions = [];
let studyPosition = 0;


// -------------------- FIREBASE AUTHENTICATION / FREEMIUM --------------------
// Η ελάχιστη πρόσβαση (3 τεστ) τηρείται στο Firestore και ελέγχεται από κανόνες.
// Δεν υπάρχει πραγματικό Premium ή λειτουργία παράκαμψης ορίων στην έκδοση αυτή.
const FREE_TEST_LIMIT = 3;
let authReady = false;
let currentUser = null;
let guestBrowsing = false;
let authRegistration = false;
let startedTests = 0;
let cloudHistory = [];
let cloudHistoryLoaded = false;
let attemptPending = false;

function authIdentity() {
    return currentUser && currentUser.emailVerified ? currentUser : null;
}

// Καλείται από το firebase-auth.js όταν αλλάξει ο πραγματικός λογαριασμός.
function firebaseAuthChanged(user) {
    const oldUid = currentUser && currentUser.uid;
    authReady = true;
    currentUser = user ? {
        uid: user.uid, email: user.email || '', displayName: user.displayName || '',
        emailVerified: !!user.emailVerified
    } : null;
    if (oldUid !== (currentUser && currentUser.uid)) {
        startedTests = 0;
        cloudHistory = [];
        cloudHistoryLoaded = false;
    }
    if (currentUser) {
        guestBrowsing = false;
        if (currentUser.emailVerified) home();
        else showEmailVerification();
    } else if (guestBrowsing) home();
    else showAuthLanding();
}

function firebaseQuotaChanged(value) {
    startedTests = Number.isInteger(value) && value >= 0 ? value : 0;
    if (document.querySelector('.home-dashboard')) home();
}

function firebaseResultsChanged(records) {
    cloudHistory = Array.isArray(records) ? records : [];
    cloudHistoryLoaded = true;
    if (document.querySelector('.insight-summary')) showInsights();
}

function firebaseSetupError(message) {
    app.innerHTML = `<section class="auth-panel"><h1>Αδυναμία σύνδεσης Firebase</h1>
        <p>${escapeHtml(message)}</p><p class="muted">Έλεγξε ότι δημοσιεύτηκαν οι κανόνες Firestore και ότι έχεις πρόσβαση στο διαδίκτυο.</p>
        <button onclick="showAuthLanding()">Επιστροφή</button></section>`;
}

function guestContinue() { if (authIdentity()) return home(); guestBrowsing = true; home(); }
function requireAccount(message = 'Για να ξεκινήσεις τεστ ή εκμάθηση πρέπει να συνδεθείς.') {
    if (authIdentity()) return true;
    if (currentUser && !currentUser.emailVerified) showEmailVerification();
    else showAuthLanding(message);
    return false;
}

function authErrorText(error) {
    const code = error && error.code;
    const messages = {
        'auth/email-already-in-use':'Υπάρχει ήδη λογαριασμός με αυτό το email.',
        'auth/invalid-email':'Η διεύθυνση email δεν είναι έγκυρη.',
        'auth/weak-password':'Χρησιμοποίησε κωδικό τουλάχιστον 6 χαρακτήρων.',
        'auth/invalid-credential':'Λάθος email ή κωδικός.',
        'auth/wrong-password':'Λάθος email ή κωδικός.',
        'auth/popup-closed-by-user':'Έκλεισε το παράθυρο σύνδεσης Google.',
        'auth/popup-blocked':'Το πρόγραμμα περιήγησης απέκλεισε το παράθυρο Google.',
        'auth/unauthorized-domain':'Ο τομέας δεν είναι εγκεκριμένος στο Authentication → Settings → Authorized domains.',
        'auth/network-request-failed':'Δεν υπάρχει σύνδεση στο διαδίκτυο.',
        'permission-denied':'Δεν επιτρέπεται πρόσβαση στο Firestore. Έλεγξε τους κανόνες στην κονσόλα.'
    };
    return messages[code] || `Αδυναμία ολοκλήρωσης σύνδεσης (${escapeHtml(code || 'άγνωστο σφάλμα')}).`;
}

function showAuthLanding(message = '') {
    guestBrowsing = false;
    app.innerHTML = `
        <section class="auth-panel">
            <div class="auth-brand"><span class="auth-glyph">◈</span><span>ΣΤΟΧΟΣ</span></div>
            <p class="home-kicker">ΑΣΕΠ • Προσωπική εξάσκηση</p>
            <h1>${authRegistration ? 'Δημιουργία λογαριασμού' : 'Καλώς ήρθες στην προετοιμασία ΑΣΕΠ 2027'}</h1>
            <p class="muted">Ανακάλυψε τα τεστ γνώσεων, τα σχήματα και τα διαθέσιμα πακέτα.</p>
            ${message ? `<p class="plans-message" role="alert">${escapeHtml(message)}</p>` : ''}
            <div class="auth-buttons">
                <button class="auth-google" onclick="loginWithGoogle()">Συνέχεια με Google</button>
                <div class="auth-separator">ή με email</div>
                <label for="auth-email">Email</label>
                <input id="auth-email" type="email" autocomplete="email" placeholder="email@example.com"/>
                <label for="auth-password">Κωδικός</label>
                <input id="auth-password" type="password" minlength="6" autocomplete="${authRegistration ? 'new-password' : 'current-password'}" placeholder="Τουλάχιστον 6 χαρακτήρες"/>
                <button onclick="loginWithEmail()">${authRegistration ? 'Δημιουργία λογαριασμού' : 'Σύνδεση'}</button>
                <button class="auth-text-action" onclick="toggleRegistration()">${authRegistration ? 'Έχεις λογαριασμό; Σύνδεση' : 'Δεν έχεις λογαριασμό; Εγγραφή'}</button>
                <div class="auth-divider"></div>
                <button class="secondary" onclick="guestContinue()">Συνέχεια ως επισκέπτης</button>
            </div>
            <p class="auth-disclaimer">Ως επισκέπτης μπορείς να περιηγηθείς στην πλατφόρμα και στα πακέτα. Για τεστ ή εκμάθηση χρειάζεσαι λογαριασμό.</p>
        </section>`;
}

function toggleRegistration() { authRegistration = !authRegistration; showAuthLanding(); }
async function loginWithGoogle() {
    if (!window.StoxosFirebase) return showAuthLanding('Το Firebase δεν φορτώθηκε ακόμη. Δοκίμασε ξανά.');
    try { await window.StoxosFirebase.loginGoogle(); }
    catch (e) { showAuthLanding(authErrorText(e)); }
}
async function loginWithEmail() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return showAuthLanding('Συμπλήρωσε email και κωδικό.');
    if (!window.StoxosFirebase) return showAuthLanding('Το Firebase δεν φορτώθηκε ακόμη.');
    try {
        const register = authRegistration;
        await window.StoxosFirebase.loginEmail(email, password, register);
    } catch(e) { showAuthLanding(authErrorText(e)); }
}
function showEmailVerification(message = '') {
    app.innerHTML = `<section class="auth-panel">
        <p class="home-kicker">ΕΠΑΛΗΘΕΥΣΗ EMAIL</p><h1>Επιβεβαίωσε τη διεύθυνσή σου</h1>
        <p>Στείλαμε σύνδεσμο επαλήθευσης στο <strong>${escapeHtml((currentUser && currentUser.email) || '')}</strong> εφόσον ολοκλήρωσες την εγγραφή.</p>
        <p class="muted">Άνοιξε το email και πάτησε τον σύνδεσμο. Έλεγξε και τα ανεπιθύμητα.</p>
        ${message ? `<p class="plans-message">${escapeHtml(message)}</p>` : ''}
        <div class="actions"><button onclick="checkVerifiedEmail()">Επαλήθευσα το email</button>
        <button class="secondary" onclick="resendVerification()">Αποστολή ξανά</button></div>
        <p><button class="auth-text-action" onclick="logoutStoxos()">Αλλαγή λογαριασμού</button></p>
    </section>`;
}
async function checkVerifiedEmail() {
    try {
        const verified = await window.StoxosFirebase.checkEmailVerified();
        if (!verified) showEmailVerification('Η επαλήθευση δεν ολοκληρώθηκε ακόμη.');
    } catch(e) { showEmailVerification(authErrorText(e)); }
}
async function resendVerification() {
    try { await window.StoxosFirebase.resendVerification(); showEmailVerification('Στάλθηκε νέο email επαλήθευσης.'); }
    catch(e) { showEmailVerification(authErrorText(e)); }
}
async function logoutStoxos() {
    guestBrowsing = false;
    try { await window.StoxosFirebase.logout(); }
    catch (e) { showAuthLanding(authErrorText(e)); }
}
function accountStrip() {
    if (!authIdentity()) return `<section class="auth-guest-notice"><strong>Περιηγείσαι ως επισκέπτης</strong>
        <span>Βλέπεις τις ενότητες και τα πακέτα. Για τεστ ή εκμάθηση χρειάζεται σύνδεση.</span>
        <button onclick="showAuthLanding()">Σύνδεση / Εγγραφή</button></section>`;
    return `<div class="auth-user-strip"><span>Συνδεδεμένος: ${escapeHtml(authIdentity().displayName || authIdentity().email)}</span>
        <button class="secondary" onclick="logoutStoxos()">Αποσύνδεση</button></div>`;
}
function premiumDemoEnabled() { return false; }
function premiumStatusLabel() { return ''; }
function accessData() { return {started: startedTests, history: cloudHistory}; }
function freeTestsRemaining() { return Math.max(0, FREE_TEST_LIMIT - startedTests); }

// Ενεργοποίηση δοκιμής από Firestore TRANSACTION: προστατεύεται από firestore.rules.
async function allowTestStart() {
    if (!requireAccount()) return false;
    if (attemptPending) return false;
    if (freeTestsRemaining() === 0) {
        showPricing('Έχεις ολοκληρώσει το όριο 3 δωρεάν ενάρξεων τεστ. Οι πληρωμές δεν έχουν ενεργοποιηθεί.');
        return false;
    }
    attemptPending = true;
    try {
        const result = await window.StoxosFirebase.reserveTest();
        if (!result.allowed) {
            startedTests = FREE_TEST_LIMIT;
            showPricing('Έχεις ήδη χρησιμοποιήσει και τις 3 δωρεάν προσπάθειες.');
            return false;
        }
        startedTests = result.started;
        return true;
    } catch(error) {
        showPricing('Δεν μπορέσαμε να καταγράψουμε την προσπάθεια. Έλεγξε τη σύνδεση και τους κανόνες Firestore. ' + authErrorText(error));
        return false;
    } finally { attemptPending = false; }
}

function saveTestResult(type, correct, total) {
    if (!authIdentity() || !window.StoxosFirebase) return;
    window.StoxosFirebase.saveResult(type, correct, total).catch(err =>
        console.warn('Δεν αποθηκεύτηκε το αποτέλεσμα στο Firestore:', err));
}

function showPricing(message = '') {
    const remaining = freeTestsRemaining();
    app.innerHTML = `
        <div class="plans-heading">
            <p class="home-kicker">ΣΤΟΧΟΣ • ΠΡΟΣΒΑΣΗ</p>
            <h1>Διάλεξε τον τρόπο εξάσκησής σου</h1>
            <p class="muted">Ξεκίνα δωρεάν και αναβάθμισε όταν ενεργοποιηθούν οι συνδρομές.</p>
            ${message ? `<p class="plans-message" role="status">${escapeHtml(message)}</p>` : ''}
        </div>
        <div class="plans-grid">
            <section class="plan-card" aria-label="Δωρεάν πακέτο">
                <p class="plan-name">Δωρεάν</p><p class="plan-price">0€</p>
                <p class="plan-period">Χωρίς χρέωση</p>
                <ul><li>3 συνολικές ενάρξεις τεστ</li><li>Τεστ γνώσεων ή σχημάτων</li><li>Εκμάθηση με λογαριασμό</li></ul>
                <button class="secondary plan-action" onclick="${authIdentity() ? 'home()' : 'showAuthLanding()'}">${authIdentity() ? `Συνέχισε δωρεάν (${remaining} απομένουν)` : 'Δημιούργησε δωρεάν λογαριασμό'}</button>
            </section>
            <section class="plan-card" aria-label="Μηνιαίο Premium">
                <p class="plan-name">Premium μηνιαίο</p><p class="plan-price">8,99€<span> / μήνα</span></p>
                <p class="plan-period">Μηνιαία αυτόματη ανανέωση</p>
                <ul><li>Απεριόριστα τεστ</li><li>Γνώσεις και σχήματα</li><li>Αναλυτική πρόοδος</li></ul>
                <button class="plan-action" onclick="choosePlan('monthly')">Σύντομα διαθέσιμο</button>
            </section>
            <section class="plan-card featured" aria-label="Ετήσιο Premium">
                <span class="plan-highlight">Οικονομικότερο ανά μήνα</span>
                <p class="plan-name">Premium ετήσιο</p><p class="plan-price">3,99€<span> / μήνα*</span></p>
                <p class="plan-period">47,88€ χρέωση κάθε έτος</p>
                <ul><li>Όλα του Premium</li><li>Απεριόριστα τεστ για 12 μήνες</li><li>60€ λιγότερα ετησίως από το μηνιαίο</li></ul>
                <button class="plan-action" onclick="choosePlan('yearly')">Σύντομα διαθέσιμο</button>
            </section>
        </div>
        <p class="pricing-fineprint">* Το 3,99€/μήνα είναι η μηνιαία αναγωγή της ετήσιας πληρωμής 47,88€. Δεν γίνονται χρεώσεις και δεν ενεργοποιούνται συνδρομές σε αυτή την έκδοση.</p>
        <div class="preview-tools"><button class="secondary" onclick="home()">← Αρχική</button></div>
    `;
}

// Τα κουμπιά ΔΕΝ χρεώνουν, ΔΕΝ ενεργοποιούν Premium.
function choosePlan(plan) {
    const title = plan === 'yearly' ? 'Premium ετήσιο (47,88€/έτος)' : 'Premium μηνιαίο (8,99€/μήνα)';
    app.innerHTML = `<section class="payment-notice"><p class="home-kicker">ΣΥΝΤΟΜΑ ΔΙΑΘΕΣΙΜΟ</p>
        <h1>${title}</h1><p>Οι πληρωμές δεν έχουν ενεργοποιηθεί και δεν μπορεί να γίνει αγορά.</p>
        <p class="muted">Αργότερα θα συνδεθεί Google Play Billing και επαλήθευση συνδρομών από backend.</p>
        <div class="actions"><button class="secondary" onclick="showPricing()">Πίσω στα πακέτα</button>
        <button onclick="home()">Αρχική</button></div></section>`;
}

function showInsights() {
    if (!requireAccount('Για να δεις την πρόοδό σου χρειάζεται σύνδεση.')) return;
    // Στη δοκιμαστική έκδοση προβάλλονται τα δεδομένα του ίδιου λογαριασμού.
    const results = [...accessData().history];
    const average = results.length
        ? Math.round(results.reduce((sum, record) => sum + 100 * record.correct / Math.max(1, record.total), 0) / results.length) : null;
    const rows = results.map(record => {
        const score = Math.round(100 * record.correct / Math.max(1, record.total));
        const date = new Date(record.at);
        const dateLabel = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('el-GR');
        return `<div class="insight-row"><span>${record.type === 'inductive' ? 'Τεστ σχημάτων' : 'Τεστ γνώσεων'}<small>${dateLabel} • ${record.correct}/${record.total} σωστές</small></span><div class="insight-progress"><div style="width:${score}%"></div></div><strong>${score}%</strong></div>`;
    }).join('');
    app.innerHTML = `<p class="home-kicker">ΠΡΟΟΔΟΣ • FIRESTORE</p><h1>Η πρόοδός σου</h1>
        <div class="insight-summary"><div><strong>${results.length}</strong><span>Ολοκληρωμένα τεστ (έως 50)</span></div><div><strong>${average === null ? '—' : average + '%'}</strong><span>Μέση επίδοση</span></div></div>
        <h2>Αποτελέσματα ανά τεστ</h2>
        ${results.length ? `<div class="insight-list">${rows}</div>` : `<p class="muted">${cloudHistoryLoaded ? 'Δεν υπάρχουν ακόμη ολοκληρωμένα τεστ.' : 'Φόρτωση ιστορικού...'}</p>`}
        <div class="actions"><button class="secondary" onclick="home()">Αρχική</button><button onclick="showPricing()">Πακέτα</button></div>`;
}

// Προστασία όταν εμφανίζουμε κείμενο από τις ερωτήσεις ως HTML.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
}

// Δημιουργούμε τις επιλογές κατηγορίας για Τεστ και Εκμάθηση.
function categoryOptions() {
    const officialOrder = [
        "Συνταγματικό Δίκαιο",
        "Διοικητικό Δίκαιο",
        "Ευρωπαϊκοί Θεσμοί και Δίκαιο",
        "Οικονομικές Επιστήμες",
        "Πληροφορική και Ψηφιακή Διακυβέρνηση",
        "Σύγχρονη Ιστορία της Ελλάδος",
        "Κώδικας Κατάστασης Πολιτικών Διοικητικών Υπαλλήλων και Υπαλλήλων Ν.Π.Δ.Δ.",
        "Γενικός Κανονισμός για την Προστασία των Δεδομένων (GDPR)",
        "Διοίκηση Επιχειρήσεων και Οργανισμών",
        "Διοίκηση Ανθρώπινου Δυναμικού",
        "Κώδικας Συμπεριφοράς Δημοσίων Υπαλλήλων"
    ];
    const categories = [...new Set(BANK.map((question) => question.category))];
    categories.sort((a, b) => officialOrder.indexOf(a) - officialOrder.indexOf(b));

    return `
        <option value="all">Όλες οι κατηγορίες</option>
        ${categories.map((category) => {
            return `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`;
        }).join("")}
    `;
}

// Αρχική οθόνη — ΣΤΟΧΟΣ. Οι ενέργειες διατηρούν τις υπάρχουσες λειτουργίες.
function home() {
    if (!authReady && !guestBrowsing) return showAuthLanding();
    if (currentUser && !currentUser.emailVerified) return showEmailVerification();
    const categoryCount = new Set(BANK.map((question) => question.category)).size;
    const knowledgeCount = BANK.length.toLocaleString("el-GR");
    const inductiveCount = INDUCTIVE_QUESTIONS.length.toLocaleString("el-GR");

    app.innerHTML = `
        <div class="home-dashboard home-dashboard-minimal">
            <header class="home-intro home-intro-minimal">
                <p class="home-kicker">ΑΣΕΠ • Προσωπική εξάσκηση</p>
                <h2>Προετοιμασία για τον 3ο γραπτό διαγωνισμό ΑΣΕΠ 2027</h2>
                <p class="home-lead">Γνώσεις και επαγωγικός συλλογισμός σε μία εφαρμογή.</p>
                <div class="home-meta-row">
                    <span class="home-meta-pill">${knowledgeCount} + ${inductiveCount} ερωτήσεις</span>
                    <span class="home-meta-pill">2 ενότητες</span>
                </div>
            </header>

            ${accountStrip()}
            ${premiumStatusLabel()}
            ${authIdentity() ? `<section class="access-strip" aria-label="Πρόσβαση σε τεστ">
                <div>
                    <span class="access-label">${premiumDemoEnabled() ? 'PREMIUM • ΔΟΚΙΜΗ' : 'ΔΩΡΕΑΝ ΠΑΚΕΤΟ'}</span>
                    <p><strong>${premiumDemoEnabled() ? 'Απεριόριστα δοκιμαστικά τεστ' : `${freeTestsRemaining()} από ${FREE_TEST_LIMIT} δωρεάν τεστ απομένουν`}</strong></p>
                    <p class="muted">${premiumDemoEnabled() ? 'Μόνο προεπισκόπηση, όχι ενεργή συνδρομή.' : 'Το όριο είναι κοινό για τεστ γνώσεων και σχημάτων. Μετρά κάθε νέα έναρξη.'}</p>
                </div>
                <div class="access-actions">
                    <button class="secondary" onclick="showInsights()">Η πρόοδός μου</button>
                    <button onclick="showPricing()">Δες τα πακέτα</button>
                </div>
            </section>` : ''}

            <section class="home-course home-course-knowledge" aria-labelledby="home-knowledge-title">
                <div class="home-course-top">
                    <span class="home-course-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="M4 5.5C7.2 4.5 9.6 5.2 12 7.2c2.4-2 4.8-2.7 8-1.7v13c-3.2-1-5.6-.3-8 1.7-2.4-2-4.8-2.7-8-1.7z"/><path d="M12 7.2v13"/></svg>
                    </span>
                    <span class="home-course-index">ΓΝΩΣΕΙΣ</span>
                </div>
                <h2 id="home-knowledge-title">Ερωτήσεις γνώσεων</h2>
                <p class="home-course-desc">Μελέτη και εξάσκηση στη βασική ύλη.</p>
                <div class="home-metrics"><span>${knowledgeCount} ερωτήσεις</span><i></i><span>${categoryCount} κατηγορίες</span></div>
                <div class="home-course-actions">
                    <button class="home-primary-action" onclick="selectMode('test')">Τεστ</button>
                    <button class="home-outline-action" onclick="selectMode('study')">Εκμάθηση</button>
                </div>
            </section>

            <section class="home-course home-course-inductive" aria-labelledby="home-inductive-title">
                <div class="home-course-top">
                    <span class="home-course-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="6" height="6" rx="1"/><circle cx="17.5" cy="6.5" r="3"/><path d="m6.5 14-3.5 6h7z"/><rect x="14.5" y="14.5" width="6" height="6" rx="1"/></svg>
                    </span>
                    <span class="home-course-index">ΣΥΛΛΟΓΙΣΜΟΣ</span>
                </div>
                <h2 id="home-inductive-title">Επαγωγικός συλλογισμός</h2>
                <p class="home-course-desc">Μοτίβα, σχέσεις και λογικοί κανόνες.</p>
                <div class="home-metrics"><span>${inductiveCount} ερωτήσεις</span><i></i><span>10 επίπεδα</span></div>
                <div class="home-course-actions">
                    <button class="home-primary-action" onclick="inductiveMenu('test')">Τεστ</button>
                    <button class="home-outline-action" onclick="inductiveMenu('study')">Εκμάθηση</button>
                </div>
            </section>
        </div>
    `;
}

// Επιλογή κατηγορίας ανάλογα με τη λειτουργία.
function selectMode(mode) {
    if (!requireAccount()) return;
    const isStudy = mode === "study";
    const title = isStudy ? "Εκμάθηση" : "Τεστ";
    const startFunction = isStudy ? "startStudy()" : "start()";

    app.innerHTML = `
        <h1>${title}</h1>
        <label for="cat">Επιλογή κατηγορίας</label>
        <select id="cat" ${isStudy ? 'onchange="updateStudyStartOptions()"' : ""}>
            ${categoryOptions()}
        </select>
        ${isStudy ? `
            <label for="study-start">Έναρξη από ερώτηση</label>
            <select id="study-start"></select>
            <p class="muted">Επίλεξε τον αριθμό ερώτησης από την κατηγορία.</p>
        ` : ""}
        <p class="muted">
            ${isStudy
                ? "Θα εμφανιστούν όλες οι ερωτήσεις με τη σωστή απάντηση επιλεγμένη."
                : `Θα επιλεγούν ${QUESTIONS_PER_TEST} τυχαίες ερωτήσεις χωρίς επανάληψη.`}
        </p>
        ${isStudy ? '' : `<p class="muted">${premiumDemoEnabled() ? 'Προεπισκόπηση Premium: χωρίς όριο.' : `Διαθέσιμες δωρεάν προσπάθειες: ${freeTestsRemaining()}. Μία προσπάθεια μετρά κατά την έναρξη.`}</p>`}
        <div class="actions">
            <button class="secondary" onclick="home()">Αρχική</button>
            <button onclick="${startFunction}">Έναρξη ${isStudy ? "εκμάθησης" : "τεστ"}</button>
        </div>
    `;

    if (isStudy) {
        updateStudyStartOptions();
    }
}

// Ανανεώνουμε τους διαθέσιμους αριθμούς όταν αλλάζει η κατηγορία.
function updateStudyStartOptions() {
    const questions = selectedQuestions();
    const startSelect = document.getElementById("study-start");

    startSelect.innerHTML = questions.map((question, index) => {
        return `<option value="${index}">Ερώτηση ${question.id}</option>`;
    }).join("");
}

// Φιλτράρουμε την τράπεζα με βάση την επιλεγμένη κατηγορία.
function selectedQuestions() {
    const selectedCategory = document.getElementById("cat").value;

    return BANK.filter((question) => {
        return selectedCategory === "all" || question.category === selectedCategory;
    });
}

// Ανακατεύουμε ερωτήσεις χωρίς να αλλάξουμε την αρχική τράπεζα.
function shuffle(items) {
    const result = [...items];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

// -------------------- ΛΕΙΤΟΥΡΓΙΑ ΤΕΣΤ --------------------

async function start() {
    if (!requireAccount()) return;
    const availableQuestions = selectedQuestions();

    if (availableQuestions.length < QUESTIONS_PER_TEST) {
        alert(`Χρειάζονται τουλάχιστον ${QUESTIONS_PER_TEST} ερωτήσεις.`);
        return;
    }
    if (!await allowTestStart()) return;
    knowledgeResultLogged = false;

    test = shuffle(availableQuestions).slice(0, QUESTIONS_PER_TEST);
    answers = Array(QUESTIONS_PER_TEST).fill(null);
    position = 0;
    show();
}

function show() {
    const question = test[position];

    const optionsHtml = question.options.map((option, index) => {
        const checked = answers[position] === index ? "checked" : "";

        return `
            <label class="answer">
                <input type="radio" name="answer" value="${index}"
                       ${checked} onchange="choose(${index})">
                <b>${ANSWER_LETTERS[index]}.</b> ${escapeHtml(option)}
            </label>
        `;
    }).join("");

    const progress = ((position + 1) / QUESTIONS_PER_TEST) * 100;
    const previousDisabled = position === 0 ? "disabled" : "";
    const nextLabel = position === QUESTIONS_PER_TEST - 1 ? "Ολοκλήρωση" : "Επόμενη";

    app.innerHTML = `
        <p class="muted">
            ${escapeHtml(question.category)} · Ερώτηση ${position + 1}
            από ${QUESTIONS_PER_TEST} · Αρχικός αριθμός #${question.id}
        </p>
        <div class="bar"><div class="fill" style="width: ${progress}%"></div></div>
        <h2>${escapeHtml(question.question)}</h2>
        ${optionsHtml}
        <div class="actions">
            <button class="secondary" onclick="prev()" ${previousDisabled}>Προηγούμενη</button>
            <button onclick="next()">${nextLabel}</button>
        </div>
    `;
}

function choose(index) {
    answers[position] = index;
}

function prev() {
    if (position > 0) {
        position--;
        show();
    }
}

function next() {
    if (position < QUESTIONS_PER_TEST - 1) {
        position++;
        show();
    } else {
        finish();
    }
}

function finish() {
    const correctCount = test.reduce((total, question, index) => {
        return total + (answers[index] === question.correct ? 1 : 0);
    }, 0);

    const unansweredCount = answers.filter((answer) => answer === null).length;
    const percentage = Math.round((correctCount / QUESTIONS_PER_TEST) * 100);
    if (!knowledgeResultLogged) {
        saveTestResult('knowledge', correctCount, QUESTIONS_PER_TEST);
        knowledgeResultLogged = true;
    }

    const reviewHtml = test.map((question, index) => {
        const selectedAnswer = answers[index];
        const isCorrect = selectedAnswer === question.correct;
        const userAnswer = selectedAnswer === null
            ? "Δεν απαντήθηκε"
            : `Η απάντησή σου: ${ANSWER_LETTERS[selectedAnswer]}. ${escapeHtml(question.options[selectedAnswer])}`;

        return `
            <div class="review">
                <b>${index + 1}. ${escapeHtml(question.question)}</b>
                <p class="${isCorrect ? "good" : "bad"}">${userAnswer}</p>
                <p class="good">
                    Σωστή: ${ANSWER_LETTERS[question.correct]}.
                    ${escapeHtml(question.options[question.correct])}
                </p>
            </div>
        `;
    }).join("");

    app.innerHTML = `
        <h1>Αποτέλεσμα τεστ</h1>
        <h2>${correctCount} / ${QUESTIONS_PER_TEST} σωστές · ${percentage}%</h2>
        <p class="muted">Αναπάντητες: ${unansweredCount}</p>
        <div class="actions"><button onclick="home()">Αρχική οθόνη</button><button class="secondary" onclick="showInsights()">Αναλυτική πρόοδος</button></div>
        <h3>Ανασκόπηση απαντήσεων</h3>
        ${reviewHtml}
    `;
}

// -------------------- ΛΕΙΤΟΥΡΓΙΑ ΕΚΜΑΘΗΣΗΣ --------------------

// Στην εκμάθηση ΔΕΝ ανακατεύουμε και ΔΕΝ περιορίζουμε τις ερωτήσεις.
function startStudy() {
    if (!requireAccount()) return;
    studyQuestions = selectedQuestions();

    if (studyQuestions.length === 0) {
        alert("Δεν υπάρχουν ερωτήσεις σε αυτή την κατηγορία.");
        return;
    }

    // Η τιμή είναι η θέση μέσα στις ερωτήσεις της επιλεγμένης κατηγορίας.
    studyPosition = Number(document.getElementById("study-start").value);
    showStudy();
}

// Εμφανίζουμε και τις 4 επιλογές, με τη σωστή ήδη επιλεγμένη.
function showStudy() {
    const question = studyQuestions[studyPosition];

    const optionsHtml = question.options.map((option, index) => {
        const isCorrect = index === question.correct;
        const selected = isCorrect ? "checked" : "";
        const correctClass = isCorrect ? "correct-answer" : "";

        return `
            <label class="answer study-answer ${correctClass}">
                <input type="radio" name="study-answer" ${selected} disabled>
                <b>${ANSWER_LETTERS[index]}.</b> ${escapeHtml(option)}
                ${isCorrect ? '<span class="correct-label">✓ Σωστή</span>' : ""}
            </label>
        `;
    }).join("");

    const progress = ((studyPosition + 1) / studyQuestions.length) * 100;
    const previousDisabled = studyPosition === 0 ? "disabled" : "";
    const isLast = studyPosition === studyQuestions.length - 1;

    app.innerHTML = `
        <p class="muted">Εκμάθηση · ${escapeHtml(question.category)}</p>
        <p class="muted">
            Ερώτηση ${studyPosition + 1} από ${studyQuestions.length}
            · Αρχικός αριθμός #${question.id}
        </p>
        <div class="bar"><div class="fill" style="width: ${progress}%"></div></div>
        <label for="study-jump">Μετάβαση σε ερώτηση</label>
        <select id="study-jump" onchange="jumpToStudyQuestion(this.value)">
            ${studyQuestions.map((item, index) => {
                const selected = index === studyPosition ? "selected" : "";
                return `<option value="${index}" ${selected}>Ερώτηση ${item.id}</option>`;
            }).join("")}
        </select>
        <h2>${escapeHtml(question.question)}</h2>
        ${optionsHtml}
        <div class="actions">
            <button class="secondary" onclick="previousStudy()" ${previousDisabled}>Προηγούμενη</button>
            <button onclick="nextStudy()">${isLast ? "Τέλος εκμάθησης" : "Επόμενη"}</button>
        </div>
        <p class="home-link"><button class="secondary" onclick="home()">Αρχική οθόνη</button></p>
    `;
}

// Άμεση μετάβαση σε οποιαδήποτε ερώτηση της τρέχουσας κατηγορίας.
function jumpToStudyQuestion(value) {
    const nextPosition = Number(value);

    if (Number.isInteger(nextPosition) &&
        nextPosition >= 0 && nextPosition < studyQuestions.length) {
        studyPosition = nextPosition;
        showStudy();
    }
}

function previousStudy() {
    if (studyPosition > 0) {
        studyPosition--;
        showStudy();
    }
}

function nextStudy() {
    if (studyPosition < studyQuestions.length - 1) {
        studyPosition++;
        showStudy();
    } else {
        app.innerHTML = `
            <h1>Ολοκλήρωση εκμάθησης</h1>
            <p>Μελέτησες ${studyQuestions.length} ερωτήσεις.</p>
            <button onclick="home()">Επιστροφή στην αρχική</button>
        `;
    }
}

// Στην αρχή εμφανίζεται οθόνη εισόδου, ώσπου να απαντήσει το Firebase.
showAuthLanding();


// -------------------- ΜΕΡΟΣ 2: ΕΠΑΓΩΓΙΚΟΣ ΣΥΛΛΟΓΙΣΜΟΣ --------------------
// Το υπάρχον BANK και οι λειτουργίες γνώσεων παραμένουν ανεξάρτητα.
// Η προσαρμογή δυσκολίας ενεργοποιείται σταδιακά καθώς προστίθενται ερωτήσεις.
const INDUCTIVE_LETTERS = ["Α", "Β", "Γ", "Δ", "Ε"];
const INDUCTIVE_TEST_LENGTH = 18;
let inductiveMode = "test";
let inductiveCurrent = null;
let inductiveSelected = null;
let inductiveAnswered = false;
let inductiveLevel = 3;
let inductiveSeen = new Set();
let inductiveCorrect = 0;
let inductiveTotal = 0;
let inductiveResultLogged = false;

// Έλεγχος της δομής και των απαντήσεων πριν εμφανιστεί ερώτηση.
// Στις ακολουθίες με βέλος/κουκκίδα επαληθεύεται και η λογική της λύσης.
function validInductiveQuestion(q) {
    if (q && q.type === "logic-matrix") {
        const validOps = new Set(["xor","or","and","sub","revsub","rot-xor","rot-or","rot-sub"]);
        if (!q.id || !Number.isInteger(q.level) || q.level<1 || q.level>10 ||
            !["dots","lines"].includes(q.draw) || !Array.isArray(q.operations) ||
            q.operations.length<1 || q.operations.length>2 || q.operations.some(o=>!validOps.has(o)) ||
            !Array.isArray(q.sequence) || q.sequence.length!==9 || q.sequence[8]!==null ||
            !Array.isArray(q.options) || q.options.length!==5 ||
            !Number.isInteger(q.correct) || q.correct<0 || q.correct>4) return false;
        const valid = f => f && Array.isArray(f.layers) && f.layers.length===q.operations.length &&
            f.layers.every(v=>Number.isInteger(v)&&v>=0&&v<=511);
        if (!q.sequence.slice(0,8).every(valid) || !q.options.every(valid)) return false;
        const rotate = mask => {
            const map=[6,3,0,7,4,1,8,5,2];
            return map.reduce((m,pos,i)=>m | ((mask&(1<<i)) ? 1<<pos : 0),0);
        };
        const apply=(a,b,o)=>({xor:()=>a^b,or:()=>a|b,and:()=>a&b,
            sub:()=>a&(~b&511),revsub:()=>b&(~a&511),
            "rot-xor":()=>rotate(a)^b,"rot-or":()=>rotate(a)|b,
            "rot-sub":()=>rotate(a)&(~b&511)})[o]();
        const equality=(a,b)=>a.layers.every((v,i)=>v===b.layers[i]);
        for(let r=0;r<2;r++) {
            const a=q.sequence[3*r],b=q.sequence[3*r+1],c=q.sequence[3*r+2];
            if (!q.operations.every((o,k)=>apply(a.layers[k],b.layers[k],o)===c.layers[k])) return false;
            // Ορατές σειρές πρέπει να υποστηρίζουν μία και μόνο σχέση ανά στρώμα.
        }
        const expected=q.operations.map((o,k)=>apply(q.sequence[6].layers[k],q.sequence[7].layers[k],o));
        if(!equality(q.options[q.correct],{layers:expected}) ||
           q.options.filter(f=>equality(f,{layers:expected})).length!==1 ||
           q.options.some((f,i)=>q.options.some((g,j)=>i!==j && equality(f,g)))) return false;
        return q.operations.every((o,k)=>[...validOps].filter(candidate=>
          [0,1].every(r=>apply(q.sequence[3*r].layers[k],q.sequence[3*r+1].layers[k],candidate)===q.sequence[3*r+2].layers[k])).length===1);
    }
    if (q && q.type === "count-matrix") {
        if (!q.id || !Number.isInteger(q.level) || q.level < 1 || q.level > 10 ||
            !Array.isArray(q.sequence) || q.sequence.length !== 12 || q.sequence[11] !== null ||
            !Array.isArray(q.options) || q.options.length !== 5 ||
            !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 4 ||
            !q.rules || !Array.isArray(q.rules.rows) || q.rules.rows.length !== 3) return false;
        const rowValid = row => Array.isArray(row) && row.length === 4 &&
            row.every(v => Number.isInteger(v) && v >= 1 && v <= 4) && new Set(row).size === 4;
        if (!q.rules.rows.every(rowValid)) return false;
        const expected = q.rules.rows.flat();
        return q.sequence.every((v,i) => i === 11 || v && v.count === expected[i]) &&
            q.options.every(o => o && Number.isInteger(o.count) && o.count>=0 && o.count<=4) &&
            new Set(q.options.map(o=>o.count)).size === 5 &&
            q.options[q.correct].count === expected[11] &&
            q.options.filter(o=>o.count === expected[11]).length === 1;
    }
    const mods = {a:4,d:4,n:4,s:3,f:2,r:4};
    if (!q || !q.id || !Number.isInteger(q.level) || q.level < 1 || q.level > 10 ||
        !["sequence","matrix"].includes(q.type) || !Array.isArray(q.features) ||
        !q.features.length || new Set(q.features).size !== q.features.length ||
        q.features.some(k => !mods[k]) || !q.rules ||
        !Array.isArray(q.sequence) || q.sequence.length !== (q.type === "matrix" ? 9 : 5) ||
        q.sequence.slice(0,-1).some(f => f === null) || q.sequence.at(-1) !== null ||
        !Array.isArray(q.options) || q.options.length !== 5 ||
        !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 4) return false;
    const keys = q.features, rule = q.rules;
    const predicted = i => Object.fromEntries(keys.map(k => [k,
        q.type === "matrix" ? (rule.start[k] + Math.floor(i/3)*rule.down[k] + (i%3)*rule.across[k])%mods[k]
        : (rule.start[k] + i*rule.steps[k])%mods[k]
    ]));
    const equal = (x,y) => keys.every(k => x && y && x[k] === y[k]);
    if (!q.sequence.slice(0,-1).every((f,i) => equal(f,predicted(i)))) return false;
    const expected = predicted(q.sequence.length-1);
    if (!equal(q.options[q.correct],expected)) return false;
    if (q.options.filter(f => equal(f,expected)).length !== 1) return false;
    return q.options.every((f,i) => keys.every(k => Number.isInteger(f[k]) && f[k]>=0 && f[k]<mods[k]) &&
        q.options.every((other,j) => i===j || !equal(f,other)));
}

function inductiveBank() {
    return INDUCTIVE_QUESTIONS.filter(validInductiveQuestion);
}

function inductiveMenu(mode) {
    if (!requireAccount()) return;
    inductiveMode = mode;
    const available = inductiveBank();
    const studyLevels = [...new Set(available.map(q => q.level))].sort((a,b)=>a-b);
    app.innerHTML = `
        <h1>Επαγωγικός Συλλογισμός · ${mode === "study" ? "Εκμάθηση" : "Τεστ"}</h1>
        <p class="muted">${available.length} ελεγμένες ερωτήσεις SVG, χωρίς εξωτερικά αρχεία εικόνων.</p>
        ${mode === "test" ? `<p class="muted">${premiumDemoEnabled() ? 'Προεπισκόπηση Premium: χωρίς όριο τεστ.' : `Δωρεάν τεστ που απομένουν: ${freeTestsRemaining()} (κοινό όριο με τα τεστ γνώσεων).`}</p>` : ''}
        ${mode === "test" ? `
            <p class="muted">Το τεστ ξεκινά πάντα από το επίπεδο 3/10, περιλαμβάνει 18 ερωτήσεις χωρίς επανάληψη και η δυσκολία προσαρμόζεται ανάλογα με τις απαντήσεις.</p>
        ` : `
            <label for="inductive-study-level">Επιλογή επιπέδου εκμάθησης</label>
            <select id="inductive-study-level">
                <option value="all">Όλα τα επίπεδα (${available.length} ερωτήσεις)</option>
                ${studyLevels.map(level => `<option value="${level}">Επίπεδο ${level}/10 (${available.filter(q=>q.level===level).length} ερωτήσεις)</option>`).join("")}
            </select>
            <p class="muted">Στην εκμάθηση εμφανίζεται το επίπεδο κάθε ερώτησης και η επεξήγηση μετά την απάντηση. Με την επιλογή «Όλα» θα εξασκηθείς σε όλες τις ερωτήσεις χωρίς επανάληψη. Διαφορετικά, θα μελετήσεις μόνο το επιλεγμένο επίπεδο.</p>`}
        <div class="actions">
            <button class="secondary" onclick="home()">Αρχική</button>
            <button onclick="startInductive()" ${available.length ? "" : "disabled"}>Έναρξη</button>
        </div>
    `;
}

let inductiveStudyLevel = "all";
async function startInductive() {
    if (!requireAccount()) return;
    if (inductiveMode === 'test' && !await allowTestStart()) return;
    inductiveResultLogged = false;
    inductiveLevel = 3; // Οριστικό αρχικό επίπεδο για κάθε τεστ.
    if (inductiveMode === "study") {
        const value = document.getElementById("inductive-study-level").value;
        inductiveStudyLevel = value === "all" ? "all" : Number(value);
    }
    inductiveSeen = new Set();
    inductiveCorrect = 0;
    inductiveTotal = 0;
    nextInductiveQuestion();
}

function nextInductiveQuestion() {
    const remaining = inductiveBank().filter(q => !inductiveSeen.has(q.id) && (inductiveMode === "test" || inductiveStudyLevel === "all" || q.level === inductiveStudyLevel));
    const reachedLimit = inductiveMode === "test" && inductiveTotal >= INDUCTIVE_TEST_LENGTH;
    if (reachedLimit || !remaining.length) {
        if (inductiveMode === 'test' && !inductiveResultLogged && inductiveTotal > 0) {
            saveTestResult('inductive', inductiveCorrect, inductiveTotal);
            inductiveResultLogged = true;
        }
        app.innerHTML = `
            <h1>Ολοκλήρωση ${inductiveMode === "test" ? "τεστ" : "εκμάθησης"}</h1>
            <h2>${inductiveCorrect} / ${inductiveTotal} σωστές</h2>
            ${reachedLimit ? `<p class="muted">Ολοκληρώθηκαν και οι ${INDUCTIVE_TEST_LENGTH} ερωτήσεις του τεστ.</p><p class="muted">Ποσοστό επιτυχίας: ${Math.round(100 * inductiveCorrect / inductiveTotal)}%</p>` : `<p class="muted">Ολοκληρώθηκαν όλες οι διαθέσιμες ερωτήσεις χωρίς επανάληψη.</p>`}
            <div class="actions"><button class="secondary" onclick="home()">Αρχική</button>
            ${inductiveMode === 'test' ? '<button class="secondary" onclick="showInsights()">Αναλυτική πρόοδος</button>' : ''}
            <button onclick="inductiveMenu('${inductiveMode}')">Νέα προσπάθεια</button></div>
        `;
        return;
    }
    // Επιλογή από το πλησιέστερο διαθέσιμο επίπεδο.
    const minDistance = Math.min(...remaining.map(q => Math.abs(q.level - inductiveLevel)));
    const candidates = inductiveMode === "study" ? remaining : remaining.filter(q => Math.abs(q.level - inductiveLevel) === minDistance);
    inductiveCurrent = candidates[Math.floor(Math.random() * candidates.length)];
    inductiveSeen.add(inductiveCurrent.id);
    inductiveSelected = null;
    inductiveAnswered = false;
    showInductive();
}

// Ακριβές γεωμετρικό σχέδιο. Όλες οι συντεταγμένες είναι σταθερές και ελεγχόμενες.
function inductiveSvgFrame(frame) {
    const outline = `<rect x="2" y="2" width="136" height="136" rx="3" fill="white" stroke="#24344a" stroke-width="2.5"/>`;
    if (frame === null) return `<svg viewBox="0 0 140 140" role="img" aria-label="Σχήμα που λείπει">${outline}<text x="70" y="98" text-anchor="middle" font-size="78" fill="#24344a">?</text></svg>`;
    let parts = '';
    if ('a' in frame) {
        parts += ('s' in frame || 'f' in frame) ? `<g transform="rotate(${frame.a*90} 105 70)" stroke="#24344a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M105 83 V57 M97 65 L105 55 L113 65"/></g>` : `<g transform="rotate(${frame.a*90} 70 70)" stroke="#24344a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M70 100 V46 M54 62 L70 44 L86 62"/></g>`;
    }
    if ('layers' in frame) {
        const dotPositions = [[36,36],[70,36],[104,36],[36,70],[70,70],[104,70],[36,104],[70,104],[104,104]];
        const linePositions = [
            [28,31,52,31],[58,31,82,31],[88,31,112,31],
            [28,70,52,70],[58,70,82,70],[88,70,112,70],
            [28,109,52,109],[58,109,82,109],[88,109,112,109]
        ];
        frame.layers.forEach((mask,k)=> {
            for(let i=0;i<9;i++) if(mask & (1<<i)) {
                const [cx,cy]=dotPositions[i];
                if (frame.draw === 'lines') {
                    const [x1,y1,x2,y2]=linePositions[i];
                    parts += `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${k===0?'#24344a':'#087d9c'}" stroke-width="${k===0?7:4}" stroke-linecap="round"/>`;
                } else {
                    parts += k===0 ? `<circle cx="${cx}" cy="${cy}" r="9" fill="#24344a"/>` : `<rect x="${cx-6}" y="${cy-6}" width="12" height="12" fill="none" stroke="#087d9c" stroke-width="3"/>`;
                }
            }
        });
    }
    if ('count' in frame) {
        // Κύκλοι σε μεγάλο, ευανάγνωστο πλέγμα 2x2 (τυπολογία δεύτερου επίσημου παραδείγματος).
        const positions = [[48,48],[92,48],[48,92],[92,92],[70,70]];
        for(let j=0;j<frame.count;j++) {
            const [cx,cy]=positions[j];
            parts += `<circle cx="${cx}" cy="${cy}" r="12" fill="#24344a"/>`;
        }
    }
    if ('d' in frame) {
        const [[cx,cy]] = [[[24,24],[116,24],[116,116],[24,116]][frame.d]];
        parts += `<circle cx="${cx}" cy="${cy}" r="8" fill="#24344a"/>`;
    }
    if ('n' in frame) {
        // One to four separate small circular marks, in fixed positions on the lower edge.
        for (let j=0;j<=frame.n;j++) parts += `<circle cx="${46+j*16}" cy="126" r="4" fill="#397a99"/>`;
    }
    if ('s' in frame) {
        const fill = frame.f === 1 ? '#d7e9f2' : 'white';
        const rotate = (frame.r || 0)*90;
        const paths = [
          `<polygon points="70,57 84,82 56,82" fill="${fill}" stroke="#1765b3" stroke-width="3"/>`,
          `<rect x="58" y="58" width="24" height="24" fill="${fill}" stroke="#1765b3" stroke-width="3"/>`,
          `<path d="M70 55 L85 70 L70 85 L55 70 Z" fill="${fill}" stroke="#1765b3" stroke-width="3"/>`
        ];
        parts += `<g transform="rotate(${rotate} 70 70)">${paths[frame.s]}${'r' in frame ? `<circle cx="79" cy="60" r="3.5" fill="#b04d28"/>` : ''}</g>`;
    } else if ('f' in frame) {
        // Fill state is represented even in questions without a changing shape type.
        parts += `<rect x="60" y="60" width="20" height="20" rx="2" fill="${frame.f ? '#24344a' : 'white'}" stroke="#1765b3" stroke-width="3"/>`;
    }
    if ('r' in frame && !('s' in frame)) {
        parts += `<g transform="rotate(${frame.r*90} 70 70)" fill="none" stroke="#b04d28" stroke-width="4"><path d="M57 89 L57 51 L79 51"/></g>`;
    }
    return `<svg viewBox="0 0 140 140" role="img" aria-label="Γεωμετρικό σχήμα">${outline}${parts}</svg>`;
}

function showInductive() {
    const q = inductiveCurrent;
    const renderFrame = f => inductiveSvgFrame(f && q.type === "logic-matrix" ? {...f, draw:q.draw} : f);
    app.innerHTML = `
        <p class="muted">Επαγωγικός Συλλογισμός · ${inductiveMode === "test" ? "Τεστ" : `Εκμάθηση · Επίπεδο ${q.level}/10`}</p>
        <p class="muted">Ερώτηση ${inductiveTotal + 1}${inductiveMode === "test" ? ` / ${INDUCTIVE_TEST_LENGTH}` : ""} · ${escapeHtml(q.id)}</p>
        <h2>Ποιο σχήμα λείπει;</h2>
        <div class="inductive-sequence ${q.type === "matrix" ? "inductive-matrix" : q.type === "count-matrix" ? "inductive-matrix-four" : q.type === "logic-matrix" ? "inductive-matrix" : ""}">${q.sequence.map(renderFrame).map(s => `<div class="inductive-frame">${s}</div>`).join("")}</div>
        <h3>Απαντήσεις</h3>
        <div class="inductive-options">${q.options.map((f,i) => `
            <button class="inductive-option" id="inductive-option-${i}" onclick="chooseInductive(${i})" aria-label="Επιλογή ${INDUCTIVE_LETTERS[i]}" aria-pressed="false">
                ${renderFrame(f)}<strong>${INDUCTIVE_LETTERS[i]}</strong>
            </button>`).join("")}</div>
        <div id="inductive-feedback" aria-live="polite"></div>
        <div class="actions"><button class="secondary" onclick="home()">Αρχική</button>
            <button id="inductive-check" onclick="checkInductive()" disabled>Έλεγχος απάντησης</button></div>
    `;
}

function chooseInductive(index) {
    if (inductiveAnswered) return;
    inductiveSelected = index;
    document.querySelectorAll(".inductive-option").forEach((button,i) => {
        button.classList.toggle("selected",i === index);
        button.setAttribute("aria-pressed",String(i === index));
    });
    document.getElementById("inductive-check").disabled = false;
}

function checkInductive() {
    if (inductiveAnswered || inductiveSelected === null) return;
    inductiveAnswered = true;
    inductiveTotal++;
    const correct = inductiveSelected === inductiveCurrent.correct;
    if (correct) inductiveCorrect++;
    // Μεταβολή στόχου κατά ένα επίπεδο, εντός 1-10.
    if (inductiveMode === "test") inductiveLevel = Math.max(1, Math.min(10, inductiveLevel + (correct ? 1 : -1)));
    document.querySelectorAll(".inductive-option").forEach((button,i) => {
        button.disabled = true;
        if (i === inductiveCurrent.correct) button.classList.add("correct");
        if (i === inductiveSelected && !correct) button.classList.add("incorrect");
    });
    document.getElementById("inductive-feedback").innerHTML = `
        <div class="inductive-feedback ${correct ? "inductive-success" : "inductive-error"}">
            <strong>${correct ? "Σωστά!" : `Η σωστή απάντηση είναι η ${INDUCTIVE_LETTERS[inductiveCurrent.correct]}.`}</strong>
            <p>${escapeHtml(inductiveCurrent.explanation)}</p>
            ${inductiveMode === "test" && inductiveTotal < INDUCTIVE_TEST_LENGTH ? `<p class="muted">Επόμενος στόχος δυσκολίας: ${inductiveLevel}/10 (εφόσον υπάρχουν διαθέσιμες ερωτήσεις).</p>` : ""}
        </div>`;
    const button = document.getElementById("inductive-check");
    button.textContent = inductiveMode === "test" && inductiveTotal >= INDUCTIVE_TEST_LENGTH ? "Προβολή αποτελεσμάτων" : "Επόμενη ερώτηση";
    button.disabled = false;
    button.onclick = nextInductiveQuestion;
}
