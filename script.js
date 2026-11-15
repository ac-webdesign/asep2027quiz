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
let knowledgeChecked = false;

// Δεδομένα για τη λειτουργία Εκμάθησης.
let studyQuestions = [];
let studyPosition = 0;
let studyCategory = 'all'; // Φίλτρο εκμάθησης για σωστή επαναφορά από όλες τις κατηγορίες.
// Προσωπική πρόοδος εκμάθησης, ανεξάρτητη από τα ημιτελή τεστ.
let savedStudies = {knowledge:null, inductive:null};
let studySaveQueue = {knowledge:Promise.resolve(), inductive:Promise.resolve()};
let studyRevision = {knowledge:0, inductive:0};
let studySaveError = {knowledge:false, inductive:false};
let currentStudyKind = null;

function firebaseStudyChanged(kind, record) {
    if (!['knowledge','inductive'].includes(kind)) return;
    // Όσο υπάρχει τοπική αλλαγή σε εκκρεμότητα, η παλαιότερη εικόνα του listener δεν υπερισχύει.
    if (!currentStudyKind || currentStudyKind !== kind) savedStudies[kind] = record || null;
    if (document.querySelector('.home-dashboard')) home();
}
function studyPayload(kind) {
    if (kind === 'knowledge') {
        const q=studyQuestions[studyPosition];
        return {category:studyCategory, questionId:String(q.id), position:studyPosition,
            level:0, seenIds:[], correct:0, total:0, selected:null, answered:false};
    }
    return {category:String(inductiveStudyLevel), questionId:inductiveCurrent?.id||'',
        position:0, level:inductiveLevel, seenIds:[...inductiveSeen],
        correct:inductiveCorrect, total:inductiveTotal, selected:inductiveSelected, answered:inductiveAnswered};
}
function saveStudyProgress(kind) {
    if (!authIdentity() || currentStudyKind!==kind) return Promise.resolve();
    const uid=currentUser.uid, revision=++studyRevision[kind], data=studyPayload(kind);
    // Καταγράφουμε διαδοχικά τις αλλαγές, ώστε να μην αντικαθίστανται από παλιότερες.
    studySaveQueue[kind]=studySaveQueue[kind].catch(()=>{}).then(async()=>{
        if (currentUser?.uid!==uid || studyRevision[kind]!==revision) return;
        await window.StoxosFirebase.saveStudy(kind,data);
        savedStudies[kind]=data;
        studySaveError[kind]=false;
    }).catch(err=>{studySaveError[kind]=true;console.error('Αποθήκευση εκμάθησης:',err);});
    return studySaveQueue[kind];
}
function studyBanner() {
    if (!authIdentity()) return '';
    return ['knowledge','inductive'].filter(kind=>savedStudies[kind]).map(kind=>{
        const record=savedStudies[kind];
        const title=kind==='knowledge'?'Εκμάθηση γνώσεων':'Εκμάθηση σχημάτων';
        const position=kind==='knowledge'?`Ερώτηση #${escapeHtml(record.questionId)}`:`Ερώτηση ${record.total+1}`;
        return `<section class="access-strip access-strip-compact" aria-label="Αποθηκευμένη εκμάθηση">
            <div class="access-compact-info"><span class="access-label">ΣΥΝΕΧΕΙΑ ΕΚΜΑΘΗΣΗΣ</span>
            <strong>${title}</strong><span class="access-compact-meta">${position}</span></div>
            <div class="access-actions"><button onclick="resumeStudy('${kind}')">Συνέχεια</button>
            <button class="secondary access-delete" onclick="discardStudy('${kind}')" title="Διαγραφή προόδου" aria-label="Διαγραφή προόδου ${title}">✕</button></div>
        </section>`;
    }).join('');
}
async function resumeStudy(kind) {
    if (!requireAccount() || !['knowledge','inductive'].includes(kind)) return;
    try {
        await studySaveQueue[kind];
        const record=await window.StoxosFirebase.getStudy(kind);
        if (!record) {savedStudies[kind]=null;home();return;}
        if (kind==='knowledge') {
            // Παλιά αποθήκευση: η κατηγορία ήταν πάντα αυτή της τρέχουσας
            // ερώτησης, ακόμη κι αν η εκμάθηση είχε αρχίσει από «Όλες».
            const questionInCategory=BANK.filter(q=>q.category===record.category);
            const inCategoryIndex=questionInCategory.findIndex(q=>String(q.id)===record.questionId);
            const inAllAtSavedPosition=BANK[record.position] && String(BANK[record.position].id)===record.questionId;
            const legacyAll=inAllAtSavedPosition && record.position!==inCategoryIndex;
            studyCategory=(record.category==='all' || legacyAll) ? 'all' : record.category;
            studyQuestions=studyCategory==='all' ? BANK : questionInCategory;
            let index=studyQuestions.findIndex(q=>String(q.id)===record.questionId);
            if (index<0) throw Error('Δεν βρέθηκε η αποθηκευμένη ερώτηση.');
            studyPosition=index;
            currentStudyKind='knowledge';
            savedStudies[kind]=record;
            showStudy();
        } else {
            const found=INDUCTIVE_QUESTIONS.find(q=>q.id===record.questionId);
            if (!found) throw Error('Δεν βρέθηκε η αποθηκευμένη άσκηση.');
            inductiveMode='study';inductiveActiveTest=false;
            inductiveStudyLevel=record.category==='all'?'all':Number(record.category);
            inductiveSeen=new Set(record.seenIds);
            inductiveCurrent=found;inductiveSeen.add(found.id);
            inductiveLevel=record.level;inductiveCorrect=record.correct;inductiveTotal=record.total;
            inductiveSelected=record.selected;inductiveAnswered=record.answered;
            currentStudyKind='inductive';savedStudies[kind]=record;
            showInductive();
            if (inductiveAnswered) showInductiveFeedback();
            else if (inductiveSelected!==null) chooseInductive(inductiveSelected);
        }
    } catch(err) {alert('Δεν έγινε ανάκτηση εκμάθησης: '+(err.message||err));home();}
}
async function finishStudyProgress(kind) {
    if (!authIdentity()) return;
    const uid=currentUser.uid;
    const revision=++studyRevision[kind];
    try {
        await studySaveQueue[kind];
        if (currentUser?.uid!==uid || studyRevision[kind]!==revision) return;
        await window.StoxosFirebase.deleteStudy(kind);
        savedStudies[kind]=null;
        if (currentStudyKind===kind) currentStudyKind=null;
    } catch(err) {console.warn('Δεν καθαρίστηκε η ολοκληρωμένη εκμάθηση:',err);}
}
async function discardStudy(kind) {
    if (!requireAccount() || !['knowledge','inductive'].includes(kind)) return;
    if (!confirm('Να διαγραφεί η αποθηκευμένη πρόοδος εκμάθησης;')) return;
    try {
        ++studyRevision[kind];
        await studySaveQueue[kind];
        await window.StoxosFirebase.deleteStudy(kind);
        savedStudies[kind]=null;
        if (currentStudyKind===kind) currentStudyKind=null;
        home();
    } catch(err) {alert('Αδυναμία διαγραφής: '+(err.message||err));}
}



// -------------------- FIREBASE AUTHENTICATION / FREEMIUM --------------------
// Η ελάχιστη πρόσβαση (5 τεστ) τηρείται στο Firestore και ελέγχεται από κανόνες.
// Το Premium παρέχεται μόνο από έγκυρο entitlement του Firebase/Stripe backend.
const FREE_TEST_LIMIT = 5;
let authReady = false;
let currentUser = null;
let guestBrowsing = false;
let startedTests = 0;
let cloudHistory = [];
let cloudHistoryLoaded = false;
let attemptPending = false;
let isPremium = false;
let inductiveActiveTest = false;
let activeTestId = null;
let resultSaving = false;
let savedAttempt = null;
let resumeLoading = false;
let progressQueue = Promise.resolve();
let progressError = false;
let resumeSession = 0;

function firebaseAttemptChanged(record) {
    savedAttempt = record || null;
    if (document.querySelector('.home-dashboard')) home();
}
function queueAttemptSave() {
    if (!activeTestId || !authIdentity()) return Promise.resolve();
    const id = activeTestId;
    const uid = currentUser.uid;
    const state = inductiveMode === 'test' && inductiveActiveTest ? {
        id, type:'inductive', questionIds: [...inductiveSeen], answers:[], position:0,
        level:inductiveLevel, correct:inductiveCorrect, total:inductiveTotal,
        currentId:inductiveCurrent?.id || '', selected:inductiveSelected,
        answered:inductiveAnswered
    } : {
        id, type:'knowledge', questionIds:test.map(q=>q.id), answers:[...answers], position,
        level:0, correct:0, total:0, currentId:'', selected:null, answered:knowledgeChecked
    };
    // Διαδοχικές ενημερώσεις, ώστε παλιότερη αποθήκευση να μην υπερισχύσει νεότερης.
    progressQueue = progressQueue.catch(()=>{}).then(async()=>{
        if (currentUser?.uid !== uid || activeTestId !== id) return;
        await window.StoxosFirebase.updateAttempt(state);
        savedAttempt = state;
        progressError = false;
    }).catch(err=>{progressError=true; console.error('Αποθήκευση προσπάθειας:',err);});
    return progressQueue;
}
async function flushProgress() {
    await progressQueue;
    if (progressError) { alert('Η πρόοδος δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.'); return false; }
    return true;
}
function resumeBanner() {
    if (!authIdentity() || !savedAttempt) return '';
    const name = savedAttempt.type === 'knowledge' ? 'Τεστ γνώσεων' : 'Τεστ σχημάτων';
    const n = savedAttempt.type === 'knowledge' ? Math.min(25,(savedAttempt.position||0)+1) : Math.min(18,(savedAttempt.total||0)+1);
    return `<section class="access-strip access-strip-compact" aria-label="Ημιτελές τεστ">
        <div class="access-compact-info"><span class="access-label">ΣΥΝΕΧΕΙΑ ΤΕΣΤ</span>
        <strong>${name}</strong><span class="access-compact-meta">Ερώτηση ${n}</span></div>
        <div class="access-actions"><button onclick="resumeSavedTest()">Συνέχεια</button>
        <button class="secondary access-delete" onclick="discardSavedTest()" title="Διαγραφή προσπάθειας" aria-label="Διαγραφή προσπάθειας">✕</button></div>
    </section>`;
}
async function resumeSavedTest() {
    if (!requireAccount() || resumeLoading) return;
    resumeLoading = true;
    try {
        await progressQueue;
        const state = await window.StoxosFirebase.getAttempt();
        if (!state) { savedAttempt=null; home(); return; }
        savedAttempt=state;
        activeTestId=state.id;
        progressError=false;
        if (state.type === 'knowledge') {
            const byId=new Map(BANK.map(q=>[q.id,q]));
            test=state.questionIds.map(id=>byId.get(id));
            if (test.length!==QUESTIONS_PER_TEST || test.some(q=>!q)) throw Error('Δεν βρέθηκαν όλες οι ερωτήσεις του αποθηκευμένου τεστ.');
            answers=state.answers.slice(); position=state.position;
            knowledgeChecked=!!state.answered;
            knowledgeResultLogged=false; inductiveActiveTest=false;
            show();
        } else {
            const byId=new Map(INDUCTIVE_QUESTIONS.map(q=>[q.id,q]));
            inductiveMode='test'; inductiveActiveTest=true; inductiveResultLogged=false;
            inductiveSeen=new Set(state.questionIds);
            inductiveLevel=state.level; inductiveCorrect=state.correct; inductiveTotal=state.total;
            inductiveCurrent=byId.get(state.currentId);
            inductiveSelected=state.selected; inductiveAnswered=!!state.answered;
            if (!inductiveCurrent) throw Error('Δεν βρέθηκε το αποθηκευμένο σχήμα.');
            showInductive();
            if (inductiveAnswered) showInductiveFeedback();
            else if (inductiveSelected!==null) chooseInductive(inductiveSelected);
        }
    } catch(err) { console.error(err); alert('Αποτυχία ανάκτησης του τεστ: '+(err.message||err)); home(); }
    finally { resumeLoading=false; }
}
async function discardSavedTest() {
    if (!requireAccount() || !savedAttempt) return;
    if (!confirm('Θέλεις να διαγράψεις το ημιτελές τεστ; Οι απαντήσεις του θα χαθούν, χωρίς να καταχωριστεί ολοκλήρωση.')) return;
    try {
        await progressQueue;
        await window.StoxosFirebase.deleteAttempt(savedAttempt.id);
        savedAttempt=null; activeTestId=null; inductiveActiveTest=false;
        home();
    } catch(err) { alert('Δεν έγινε διαγραφή: '+(err.message||err)); }
}

function firebasePremiumChanged(value) {
    isPremium = value === true;
    if (document.querySelector('.home-dashboard')) home();
    else if (document.getElementById('subscription-details')) loadSubscriptionDetails();
}
function newTestId() {
    if (!globalThis.crypto?.randomUUID) throw Error('Απαιτείται ασφαλής σύνδεση HTTPS.');
    return crypto.randomUUID();
}

function authIdentity() {
    return currentUser || null;
}

// Καλείται από το firebase-auth.js όταν αλλάξει ο πραγματικός λογαριασμός.
function firebaseAuthChanged(user) {
    const oldUid = currentUser && currentUser.uid;
    authReady = true;
    currentUser = user ? {
        uid: user.uid, email: user.email || '', displayName: user.displayName || ''
    } : null;
    if (oldUid !== (currentUser && currentUser.uid)) {
        subscriptionDetailsRequest++;
        startedTests = 0;
        cloudHistory = [];
        cloudHistoryLoaded = false;
        isPremium = false;
        activeTestId = null;
        savedAttempt = null;
        progressQueue = Promise.resolve();
        progressError = false;
        inductiveActiveTest = false;
        savedStudies = {knowledge:null,inductive:null};
        studyRevision.knowledge++;studyRevision.inductive++;
        currentStudyKind=null;
        studySaveQueue={knowledge:Promise.resolve(),inductive:Promise.resolve()};
    }
    if (currentUser) {
        guestBrowsing = false;
        if (window.stoxosCheckoutNotice) showPricing(); else home();
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
    if (accountDeletionPending) return; // Οι listeners κλείνουν κατά την οριστική διαγραφή.
    app.innerHTML = `<section class="auth-panel"><h1>Αδυναμία σύνδεσης Firebase</h1>
        <p>${escapeHtml(message)}</p><p class="muted">Έλεγξε ότι δημοσιεύτηκαν οι κανόνες Firestore και ότι έχεις πρόσβαση στο διαδίκτυο.</p>
        <button onclick="showAuthLanding()">Επιστροφή</button></section>`;
}

function guestContinue() { if (authIdentity()) return home(); guestBrowsing = true; home(); }
function requireAccount(message = 'Για να ξεκινήσεις τεστ ή εκμάθηση πρέπει να συνδεθείς.') {
    if (authIdentity()) return true;
    showAuthLanding(message);
    return false;
}

function authErrorText(error) {
    const code = error && error.code;
    const messages = {
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
            <div class="auth-brand"><img class="auth-brand-logo" src="brand-icon.png" alt="" width="51" height="51"><span>ΣΤΟΧΟΣ</span></div>
            <p class="home-kicker">ΑΣΕΠ • Προσωπική εξάσκηση</p>
            <h1>Καλώς ήρθες στην προετοιμασία σου</h1>
            <p class="muted">Ανακάλυψε τα τεστ γνώσεων, τα σχήματα και τα διαθέσιμα πακέτα.</p>
            ${message ? `<p class="plans-message" role="alert">${escapeHtml(message)}</p>` : ''}
            <div class="auth-buttons">
                <button class="auth-google" onclick="loginWithGoogle()">Συνέχεια με Google</button>
                <div class="auth-divider"></div>
                <button class="secondary" onclick="guestContinue()">Συνέχεια ως επισκέπτης</button>
            </div>
            <p class="auth-disclaimer">Η σύνδεση και η δημιουργία λογαριασμού γίνονται αποκλειστικά μέσω Google. Ως επισκέπτης μπορείς να περιηγηθείς στην πλατφόρμα και στα πακέτα. Για τεστ ή εκμάθηση χρειάζεσαι λογαριασμό. Δες την <a href="privacy.html">Πολιτική απορρήτου</a> και τους <a href="terms.html">Όρους χρήσης</a>.</p>
        </section>`;
}

async function loginWithGoogle() {
    if (!window.StoxosFirebase) return showAuthLanding('Το Firebase δεν φορτώθηκε ακόμη. Δοκίμασε ξανά.');
    try { await window.StoxosFirebase.loginGoogle(); }
    catch (e) { showAuthLanding(authErrorText(e)); }
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
function premiumDemoEnabled() { return isPremium; }
function premiumStatusLabel() { return isPremium ? '<p class="premium-active">Premium πρόσβαση ενεργή · Απεριόριστα τεστ</p>' : ''; }
function accessData() { return {started: startedTests, history: cloudHistory}; }
function freeTestsRemaining() { return Math.max(0, FREE_TEST_LIMIT - startedTests); }

// Έλεγχος δικαιώματος χωρίς κατανάλωση προσπάθειας. Η μέτρηση γίνεται κατά την ολοκλήρωση.
async function allowTestStart() {
    if (!requireAccount()) return false;
    if (attemptPending) return false;
    attemptPending = true;
    try {
        const result = await window.StoxosFirebase.canStartTest();
        isPremium = result.premium;
        startedTests = result.completed;
        if (!result.allowed) {
            showPricing('Έχεις ολοκληρώσει και τα 5 δωρεάν τεστ.');
            return false;
        }
        return true;
    } catch (error) {
        showPricing('Αδυναμία ελέγχου πρόσβασης. ' + authErrorText(error));
        return false;
    } finally { attemptPending = false; }
}

// Η συναλλαγή γράφει αποτέλεσμα + δωρεάν ολοκλήρωση ταυτόχρονα.
// Δεν πρόκειται για server-side επαλήθευση ορθότητας απαντήσεων.
async function saveTestResult(type, correct, total) {
    if (!authIdentity() || !window.StoxosFirebase || !activeTestId || resultSaving) return false;
    resultSaving = true;
    try {
        const response = await window.StoxosFirebase.saveResult(type, correct, total, activeTestId);
        startedTests = response.completed;
        isPremium = response.premium;
        activeTestId = null;
        savedAttempt = null;
        return true;
    } catch (error) {
        console.error('Αδυναμία καταχώρισης αποτελέσματος:', error);
        // Δεν επιτρέπουμε επανέναρξη χωρίς να πληροφορήσουμε για την εκκρεμότητα.
        alert('Το αποτέλεσμα δεν αποθηκεύτηκε. Έλεγξε τη σύνδεσή σου και πάτησε ξανά Ολοκλήρωση.');
        return false;
    } finally { resultSaving = false; }
}

function showPricing(message = '') {
    message = message || window.stoxosCheckoutNotice || '';
    window.stoxosCheckoutNotice = '';
    const remaining = freeTestsRemaining();
    app.innerHTML = `
        <div class="plans-heading">
            <p class="home-kicker">ΣΤΟΧΟΣ • ΠΡΟΣΒΑΣΗ</p>
            <h1>Διάλεξε τον τρόπο εξάσκησής σου</h1>
            <p class="muted">Ξεκίνα δωρεάν και δοκίμασε την αγορά Premium στο δοκιμαστικό περιβάλλον Stripe.</p>
            ${message ? `<p class="plans-message" role="status">${escapeHtml(message)}</p>` : ''}
        </div>
        ${authIdentity() ? `<div id="subscription-details" aria-live="polite"><p class="muted">Φόρτωση στοιχείων συνδρομής...</p></div>` : ``}
        <div class="plans-grid">
            <section class="plan-card" aria-label="Δωρεάν πακέτο">
                <p class="plan-name">Δωρεάν</p><p class="plan-price">0€</p>
                <p class="plan-period">Χωρίς χρέωση</p>
                <ul><li>5 συνολικά ολοκληρωμένα τεστ</li><li>Τεστ γνώσεων ή σχημάτων</li><li>Εκμάθηση με λογαριασμό</li></ul>
                <button class="secondary plan-action" onclick="${authIdentity() ? 'home()' : 'showAuthLanding()'}">${authIdentity() ? `Συνέχισε δωρεάν (${premiumDemoEnabled() ? "απεριόριστα" : remaining + " απομένουν"})` : 'Δημιούργησε δωρεάν λογαριασμό'}</button>
            </section>
            <section class="plan-card" aria-label="Μηνιαίο Premium">
                <p class="plan-name">Premium μηνιαίο</p><p class="plan-price">8,99€<span> / μήνα</span></p>
                <p class="plan-period">Μηνιαία αυτόματη ανανέωση</p>
                <ul><li>Απεριόριστα τεστ</li><li>Γνώσεις και σχήματα</li><li>Αναλυτική πρόοδος</li></ul>
                <button class="plan-action plan-premium-action" onclick="choosePlan('monthly')" ${authIdentity() ? 'disabled' : ''}>${authIdentity() ? 'Έλεγχος συνδρομής...' : 'Δοκιμαστική αγορά'}</button>
            </section>
            <section class="plan-card featured" aria-label="Ετήσιο Premium">
                <span class="plan-highlight">Οικονομικότερο ανά μήνα</span>
                <p class="plan-name">Premium ετήσιο</p><p class="plan-price">3,99€<span> / μήνα*</span></p>
                <p class="plan-period">47,88€ χρέωση κάθε έτος</p>
                <ul><li>Όλα του Premium</li><li>Απεριόριστα τεστ για 12 μήνες</li><li>60€ λιγότερα ετησίως από το μηνιαίο</li></ul>
                <button class="plan-action plan-premium-action" onclick="choosePlan('yearly')" ${authIdentity() ? 'disabled' : ''}>${authIdentity() ? 'Έλεγχος συνδρομής...' : 'Δοκιμαστική αγορά'}</button>
            </section>
        </div>
        <p class="pricing-fineprint">* Το 3,99€/μήνα είναι η μηνιαία αναγωγή της ετήσιας πληρωμής 47,88€. Δοκιμαστικό Stripe: δεν γίνονται πραγματικές χρεώσεις. Η δοκιμαστική συνδρομή ενεργοποιεί Premium στον λογαριασμό σου.</p>
        <div class="preview-tools"><button class="secondary" onclick="home()">← Αρχική</button></div>
    `;
    if (authIdentity()) loadSubscriptionDetails();
}

// Προβολή λεπτομερειών συνδρομής μόνο στον συνδεδεμένο χρήστη.
let subscriptionDetailsRequest = 0;
function updatePremiumPurchaseActions(info) {
    // Ο χρήστης που έχει ήδη Premium ή συνδρομή σε εκκρεμότητα
    // τη διαχειρίζεται από το Stripe Portal, δεν αγοράζει δεύτερο πακέτο.
    const existingStripe = info.provider === 'stripe' &&
        ['active','trialing','past_due','unpaid','paused'].includes(info.status);
    const blocked = info.premium === true || existingStripe;
    document.querySelectorAll('.plan-premium-action').forEach(button => {
        button.disabled = blocked;
        button.textContent = blocked ? 'Υπάρχει ήδη συνδρομή' : 'Δοκιμαστική αγορά';
    });
}
function subscriptionDate(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('el-GR', {day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Athens'}).format(date);
}
async function loadSubscriptionDetails() {
    const target = document.getElementById('subscription-details');
    if (!target || !authIdentity()) return;
    const uid = authIdentity().uid;
    const request = ++subscriptionDetailsRequest;
    try {
        const info = await window.StoxosFirebase.getSubscriptionStatus();
        if (request !== subscriptionDetailsRequest || authIdentity()?.uid !== uid || !target.isConnected) return;
        updatePremiumPurchaseActions(info);
        const plan = info.plan === 'monthly' ? 'Premium μηνιαίο' : info.plan === 'yearly' ? 'Premium ετήσιο' : info.premium ? 'Premium' : 'Δωρεάν';
        const end = subscriptionDate(info.currentPeriodEnd);
        const canceled = info.cancelAtPeriodEnd === true;
        const active = info.premium === true;
        const status = active ? (canceled ? 'Ακυρώθηκε η αυτόματη ανανέωση' : 'Ενεργή') : info.status === 'canceled' ? 'Ληγμένη / ακυρωμένη' : info.status === 'past_due' ? 'Εκκρεμεί πληρωμή' : 'Χωρίς ενεργή συνδρομή';
        const dateLabel = end ? (active && !canceled ? 'Επόμενη ανανέωση / τέλος περιόδου' : 'Λήξη τρέχουσας περιόδου') : null;
        target.innerHTML = `<section class="subscription-summary" aria-label="Στοιχεία συνδρομής">
            <h2>Η συνδρομή μου</h2>
            <p><strong>Πακέτο:</strong> ${escapeHtml(plan)}</p>
            <p><strong>Κατάσταση:</strong> ${escapeHtml(status)}</p>
            ${dateLabel ? `<p><strong>${dateLabel}:</strong> ${escapeHtml(end)}</p>` : ''}
            ${active && canceled ? '<p class="muted">Το Premium παραμένει ενεργό έως τη λήξη της πληρωμένης περιόδου. Δεν θα γίνει αυτόματη ανανέωση.</p>' : ''}
            ${info.provider === 'stripe' ? '<button class="secondary" onclick="manageStripeSubscription()">Διαχείριση συνδρομής</button>' : ''}
        </section>`;
    } catch (error) {
        if (request !== subscriptionDetailsRequest || !target.isConnected) return;
        console.error('Στοιχεία συνδρομής:', error);
        target.innerHTML = '<p class="muted">Δεν ήταν δυνατή η φόρτωση των στοιχείων συνδρομής. <button class="secondary" onclick="loadSubscriptionDetails()">Επανάληψη</button></p>';
    }
}

// Stripe Checkout μέσω πιστοποιημένης Firebase callable function.
let checkoutPending = false;
async function choosePlan(plan) {
    if (!['monthly', 'yearly'].includes(plan)) return;
    if (!requireAccount('Συνδέσου με Google για να κάνεις δοκιμαστική αγορά.')) return;
    if (isPremium) {
        showPricing('Έχεις ήδη ενεργή πρόσβαση Premium. Μπορείς να διαχειριστείς την υπάρχουσα συνδρομή.');
        return;
    }
    if (checkoutPending) return;
    if (!window.StoxosFirebase?.createStripeCheckout) {
        showPricing('Η σύνδεση πληρωμών δεν έχει φορτωθεί. Δοκίμασε ξανά.');
        return;
    }
    checkoutPending = true;
    const buttons = document.querySelectorAll('.plan-action');
    buttons.forEach(button => { if (!button.classList.contains('secondary')) button.disabled = true; });
    try {
        const url = await window.StoxosFirebase.createStripeCheckout(plan);
        if (typeof url !== 'string' || !url.startsWith('https://checkout.stripe.com/')) throw Error('Μη έγκυρος σύνδεσμος πληρωμής.');
        window.location.assign(url);
    } catch (error) {
        console.error('Stripe Checkout:', error);
        showPricing('Η δοκιμαστική αγορά δεν ξεκίνησε. ' + (error?.message || 'Δοκίμασε ξανά.'));
    } finally { checkoutPending = false; }
}

async function manageStripeSubscription() {
    if (!requireAccount()) return;
    try {
        const url = await window.StoxosFirebase.createStripePortal();
        if (typeof url !== 'string' || !url.startsWith('https://billing.stripe.com/')) throw Error('Μη έγκυρος σύνδεσμος διαχείρισης.');
        window.location.assign(url);
    } catch (error) { showPricing('Δεν άνοιξε η διαχείριση συνδρομής. ' + (error?.message || '')); }
}

function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('checkout');
    if (outcome !== 'success' && outcome !== 'cancel') return;
    window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    // Η επιτυχία της ανακατεύθυνσης ΔΕΝ χορηγεί Premium. Μόνο το webhook ενημερώνει Firestore.
    window.stoxosCheckoutNotice = outcome === 'success'
        ? 'Η δοκιμαστική πληρωμή ολοκληρώθηκε. Περιμένουμε επιβεβαίωση από το Stripe για το Premium.'
        : 'Η δοκιμαστική αγορά ακυρώθηκε.';
}
handleStripeReturn();

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
            ${resumeBanner()}
            ${studyBanner()}
            ${premiumStatusLabel()}
            ${authIdentity() ? `<section class="access-strip" aria-label="Πρόσβαση σε τεστ">
                <div>
                    <span class="access-label">${premiumDemoEnabled() ? 'PREMIUM' : 'ΔΩΡΕΑΝ ΠΑΚΕΤΟ'}</span>
                    <p><strong>${premiumDemoEnabled() ? 'Απεριόριστα τεστ' : `${freeTestsRemaining()} από ${FREE_TEST_LIMIT} δωρεάν τεστ απομένουν`}</strong></p>
                    <p class="muted">${premiumDemoEnabled() ? 'Ειδική πρόσβαση Premium στον λογαριασμό σου.' : 'Το όριο είναι κοινό για τεστ γνώσεων και σχημάτων. Μετρά κάθε επιτυχημένη ολοκλήρωση.'}</p>
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

// Κεντρικά μενού πλοήγησης. Οι υπάρχουσες λειτουργίες παραμένουν ίδιες.
function showActivityMenu(kind) {
    const isTest = kind === 'test';
    app.innerHTML = `
        <section class="activity-menu">
            <p class="home-kicker">ΣΤΟΧΟΣ • ${isTest ? 'ΕΞΑΣΚΗΣΗ' : 'ΜΕΛΕΤΗ'}</p>
            <h1>${isTest ? 'Τεστ' : 'Εκμάθηση'}</h1>
            <p class="muted">Επίλεξε την ενότητα που θέλεις να ${isTest ? 'εξασκηθείς' : 'μελετήσεις'}.</p>
            <div class="activity-menu-list">
                <button class="activity-menu-item" onclick="selectMode('${isTest ? 'test' : 'study'}')">
                    <span class="activity-menu-icon" aria-hidden="true">☷</span>
                    <span class="activity-menu-copy"><strong>Γνώσεις</strong><small>Ερωτήσεις ανά κατηγορία</small></span>
                    <span class="activity-menu-arrow" aria-hidden="true">›</span>
                </button>
                <button class="activity-menu-item" onclick="inductiveMenu('${isTest ? 'test' : 'study'}')">
                    <span class="activity-menu-icon" aria-hidden="true">◇</span>
                    <span class="activity-menu-copy"><strong>Σχήματα</strong><small>Επαγωγικός συλλογισμός</small></span>
                    <span class="activity-menu-arrow" aria-hidden="true">›</span>
                </button>
            </div>
        </section>`;
}

function showAccount() {
    if (!authIdentity()) {
        app.innerHTML = `<section class="account-page">
            <p class="home-kicker">Ο ΛΟΓΑΡΙΑΣΜΟΣ ΜΟΥ</p>
            <h1>Λογαριασμός</h1>
            <p class="muted">Συνδέσου με Google για να δεις την πρόοδο, τα αποτελέσματα και την πρόσβασή σου.</p>
            <div class="actions"><button onclick="showAuthLanding()">Σύνδεση με Google</button></div>
        </section>`;
        return;
    }
    const user = authIdentity();
    const results = accessData().history;
    const avg = results.length ? Math.round(results.reduce((sum,r)=>sum+100*r.correct/Math.max(1,r.total),0)/results.length) : null;
    app.innerHTML = `<section class="account-page">
        <p class="home-kicker">Ο ΛΟΓΑΡΙΑΣΜΟΣ ΜΟΥ</p>
        <h1>Λογαριασμός</h1>
        <div class="account-profile">
            <span class="account-avatar" aria-hidden="true">${escapeHtml((user.displayName || user.email || 'G').trim().charAt(0).toUpperCase())}</span>
            <div class="account-profile-copy"><strong>${escapeHtml(user.displayName || 'Χρήστης Google')}</strong><small>${escapeHtml(user.email || '')}</small></div>
        </div>
        <div class="account-stats">
            <div><strong>${cloudHistoryLoaded ? results.length : '—'}</strong><span>Πρόσφατα τεστ (έως 50)</span></div>
            <div><strong>${avg === null ? '—' : avg + '%'}</strong><span>Μέση επίδοση (έως 50)</span></div>
        </div>
        <div class="account-links">
            <button class="activity-menu-item" onclick="showInsights()"><span class="activity-menu-copy"><strong>Η πρόοδός μου</strong><small>Αποτελέσματα και επιδόσεις</small></span><span class="activity-menu-arrow">›</span></button>
            <button class="activity-menu-item" onclick="showPricing()"><span class="activity-menu-copy"><strong>Το πακέτο μου</strong><small>${premiumDemoEnabled() ? 'Premium • Απεριόριστα τεστ' : `Δωρεάν • ${freeTestsRemaining()} τεστ απομένουν`}</small></span><span class="activity-menu-arrow">›</span></button>
        </div>
        <button class="secondary account-logout" onclick="logoutStoxos()">Αποσύνδεση</button>
    </section>`;
}

function showSettings() {
    app.innerHTML = `<section class="settings-page">
        <p class="home-kicker">ΣΤΟΧΟΣ</p>
        <h1>Ρυθμίσεις</h1>
        <p class="muted">Οι πληροφορίες και οι επιλογές που αφορούν τον λογαριασμό σου.</p>
        <div class="settings-section-title">Απόρρητο και δεδομένα</div>
        <div class="settings-list">
            <a class="settings-link" href="privacy.html"><span><strong>Πολιτική απορρήτου</strong><small>Πώς χρησιμοποιούνται και προστατεύονται τα δεδομένα</small></span><span class="settings-chevron" aria-hidden="true">›</span></a>
            ${authIdentity() ? `<button class="settings-link" onclick="showDeleteAccount()"><span><strong>Διαγραφή λογαριασμού</strong><small>Οριστική διαγραφή της προόδου και του λογαριασμού σου</small></span><span class="settings-chevron" aria-hidden="true">›</span></button>` : `<a class="settings-link" href="delete-account.html"><span><strong>Διαγραφή λογαριασμού</strong><small>Σύνδεση και υποβολή αιτήματος διαγραφής</small></span><span class="settings-chevron" aria-hidden="true">›</span></a>`}
        </div>
        <div class="settings-section-title">Βοήθεια και υποστήριξη</div>
        <div class="settings-list">
            <a class="settings-link" href="support.html"><span><strong>Κέντρο βοήθειας</strong><small>Συχνές ερωτήσεις και υποστήριξη</small></span><span class="settings-chevron" aria-hidden="true">›</span></a>
        </div>
        <div class="settings-section-title">Σχετικά με την εφαρμογή</div>
        <div class="settings-list">
            <a class="settings-link" href="terms.html"><span><strong>Όροι χρήσης</strong><small>Κανόνες χρήσης και πληροφορίες συνδρομών</small></span><span class="settings-chevron" aria-hidden="true">›</span></a>
            <div class="settings-static"><span><strong>ΣΤΟΧΟΣ</strong><small>Έκδοση ανάπτυξης • Ανεξάρτητη πλατφόρμα ΑΣΕΠ</small></span></div>
        </div>
    </section>`;
}

let accountDeletionPending = false;
function showDeleteAccount(message = '') {
    if (!authIdentity()) return showAuthLanding('Συνδέσου με Google για να διαγράψεις τον λογαριασμό σου.');
    const email = authIdentity().email;
    app.innerHTML = `<section class="settings-page deletion-page">
        <button class="settings-back" onclick="showSettings()">← Ρυθμίσεις</button>
        <p class="home-kicker">ΑΠΟΡΡΗΤΟ ΚΑΙ ΔΕΔΟΜΕΝΑ</p>
        <h1>Διαγραφή λογαριασμού</h1>
        ${message ? `<p class="plans-message" role="alert">${escapeHtml(message)}</p>` : ''}
        <div class="deletion-warning"><strong>Αυτή η ενέργεια είναι οριστική.</strong>
            <p>Θα διαγραφεί ο λογαριασμός ΣΤΟΧΟΣ (${escapeHtml(email)}) και τα αποθηκευμένα τεστ, οι επιδόσεις και η πρόοδος εκμάθησης.</p>
            <p>Αν έχεις συνδρομή Stripe, θα ακυρωθεί αμέσως και η Premium πρόσβαση θα τερματιστεί χωρίς να περιμένει την ημερομηνία ανανέωσης. Η διαγραφή δεν σημαίνει αυτόματη επιστροφή χρημάτων.</p>
            <p>Ορισμένα οικονομικά στοιχεία/παραστατικά ενδέχεται να παραμείνουν στον πάροχο πληρωμών για νομικούς λόγους.</p>
        </div>
        <label class="deletion-input-label" for="deletion-confirm-input">Γράψε <strong>ΔΙΑΓΡΑΦΗ</strong> για επιβεβαίωση</label>
        <input id="deletion-confirm-input" class="deletion-confirm-input" type="text" autocomplete="off" spellcheck="false" oninput="updateDeleteButton()" placeholder="ΔΙΑΓΡΑΦΗ">
        <label class="deletion-consent"><input type="checkbox" id="deletion-confirm-check" onchange="updateDeleteButton()"><span>Κατανοώ ότι τα δεδομένα μου θα διαγραφούν οριστικά και ότι η ενεργή συνδρομή μου θα ακυρωθεί αμέσως.</span></label>
        <button id="delete-account-action" class="danger-action" onclick="confirmDeleteAccount()" disabled>Διαγραφή λογαριασμού</button>
        <p id="deletion-progress" class="muted" role="status" aria-live="polite"></p>
        <p class="settings-note">Μπορείς επίσης να χρησιμοποιήσεις τη <a href="delete-account.html">δημόσια σελίδα διαγραφής</a> χωρίς να εγκαταστήσεις την εφαρμογή.</p>
    </section>`;
}
function updateDeleteButton() {
    const button=document.getElementById('delete-account-action');
    if (!button) return;
    button.disabled = accountDeletionPending || document.getElementById('deletion-confirm-input')?.value.trim() !== 'ΔΙΑΓΡΑΦΗ' || !document.getElementById('deletion-confirm-check')?.checked;
}
async function confirmDeleteAccount() {
    if (accountDeletionPending || !authIdentity()) return;
    if (document.getElementById('deletion-confirm-input')?.value.trim() !== 'ΔΙΑΓΡΑΦΗ' || !document.getElementById('deletion-confirm-check')?.checked) return;
    if (!confirm('Τελική επιβεβαίωση: να διαγραφεί ΟΡΙΣΤΙΚΑ ο λογαριασμός και να ακυρωθεί αμέσως οποιαδήποτε συνδρομή Stripe;')) return;
    accountDeletionPending = true;
    updateDeleteButton();
    const notice = document.getElementById('deletion-progress');
    if (notice) notice.textContent='Επιβεβαίωσε ξανά τον λογαριασμό σου στο παράθυρο Google. Στη συνέχεια θα πραγματοποιηθεί η διαγραφή.';
    try {
        await window.StoxosFirebase.deleteAccount();
        // Firebase auth listener will switch to signed-out view.
        showAuthLanding('Ο λογαριασμός σου στον ΣΤΟΧΟ διαγράφηκε.');
    } catch (error) {
        console.error('Account deletion:', error);
        const now = document.getElementById('deletion-progress');
        if (now) now.textContent='Δεν ολοκληρώθηκε η διαγραφή. '+(error?.message || 'Δοκίμασε ξανά.');
    } finally { accountDeletionPending = false; updateDeleteButton(); }
}

// Επιλογή κατηγορίας ανάλογα με τη λειτουργία.
function selectMode(mode) {
    if (!requireAccount()) return;
    const isStudy = mode === "study";
    const title = isStudy ? "Εκμάθηση" : "Τεστ";
    const startFunction = isStudy ? "startStudy()" : "start()";

    if (!isStudy) {
        selectedTestCategories = new Set(); // Κενό σύνολο = όλες οι κατηγορίες.
        const categories = [...new Set(BANK.map(q => q.category))];
        const options = categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");
        app.innerHTML = `
            <section class="test-category-panel">
                <p class="home-kicker">ΤΕΣΤ ΓΝΩΣΕΩΝ</p>
                <h1>Επιλογή κατηγοριών</h1>
                <p class="muted">Επίλεξε τις κατηγορίες που θέλεις να συμπεριλάβεις στο τεστ.</p>
                <label for="test-category-select">Κατηγορία</label>
                <div class="test-category-picker">
                    <select id="test-category-select" aria-label="Επιλογή κατηγορίας">
                        <option value="all">Όλες οι κατηγορίες</option>
                        ${options}
                    </select>
                    <button type="button" class="test-category-add" onclick="addTestCategory()" aria-label="Προσθήκη κατηγορίας" title="Προσθήκη κατηγορίας">+</button>
                </div>
                <div id="test-category-tags" class="test-category-tags" aria-live="polite"></div>
                <p id="test-category-count" class="test-category-info"></p>
                <p class="muted">${QUESTIONS_PER_TEST} τυχαίες ερωτήσεις χωρίς επανάληψη.</p>
                <p class="muted">${premiumDemoEnabled() ? 'Premium: απεριόριστα τεστ.' : `Διαθέσιμες δωρεάν προσπάθειες: ${freeTestsRemaining()}. Κάθε ολοκληρωμένο τεστ μετρά μία φορά.`}</p>
                <div class="actions">
                    <button class="secondary" onclick="home()">Αρχική</button>
                    <button id="test-category-start" onclick="start()">Έναρξη τεστ</button>
                </div>
            </section>`;
        renderTestCategories();
        return;
    }

    app.innerHTML = `
        <h1>${title}</h1>
        <label for="cat">Επιλογή κατηγορίας</label>
        <select id="cat" onchange="updateStudyStartOptions()">
            ${categoryOptions()}
        </select>
        <label for="study-start">Έναρξη από ερώτηση</label>
        <select id="study-start"></select>
        <p class="muted">Επίλεξε τον αριθμό ερώτησης από την κατηγορία.</p>
        <p class="muted">Θα εμφανιστούν όλες οι ερωτήσεις με τη σωστή απάντηση επιλεγμένη.</p>
        <div class="actions">
            <button class="secondary" onclick="home()">Αρχική</button>
            <button onclick="startStudy()">Έναρξη εκμάθησης</button>
        </div>`;
    updateStudyStartOptions();
}

// Κενό σύνολο = όλες οι κατηγορίες. Μόνο για τα τεστ γνώσεων.
let selectedTestCategories = new Set();

function addTestCategory() {
    const picker = document.getElementById("test-category-select");
    if (!picker) return;
    if (picker.value === "all") selectedTestCategories.clear();
    else selectedTestCategories.add(picker.value);
    picker.value = "all";
    renderTestCategories();
}

function removeTestCategory(category) {
    selectedTestCategories.delete(category);
    renderTestCategories();
}

function resetTestCategories() {
    selectedTestCategories.clear();
    renderTestCategories();
}

function renderTestCategories() {
    const tags = document.getElementById("test-category-tags");
    if (!tags) return;
    if (selectedTestCategories.size === 0) {
        tags.innerHTML = `<span class="test-category-tag test-category-all">Όλες οι κατηγορίες</span>`;
    } else {
        tags.innerHTML = [...selectedTestCategories].map((cat, index) => `
            <span class="test-category-tag">
                <span>${escapeHtml(cat)}</span>
                <button type="button" onclick="removeTestCategoryByIndex(${index})" aria-label="Αφαίρεση κατηγορίας ${escapeHtml(cat)}" title="Αφαίρεση">×</button>
            </span>`).join("") + `<button type="button" class="test-category-reset" onclick="resetTestCategories()">Όλες</button>`;
    }
    const available = selectedQuestions().length;
    document.getElementById("test-category-count").textContent =
        `${selectedTestCategories.size || new Set(BANK.map(q => q.category)).size} κατηγορίες · ${available.toLocaleString("el-GR")} διαθέσιμες ερωτήσεις`;
    const startButton = document.getElementById("test-category-start");
    startButton.disabled = available < QUESTIONS_PER_TEST;
}

function removeTestCategoryByIndex(index) {
    const category = [...selectedTestCategories][index];
    if (category !== undefined) removeTestCategory(category);
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
    if (document.getElementById("test-category-select")) {
        return selectedTestCategories.size === 0
            ? BANK
            : BANK.filter(question => selectedTestCategories.has(question.category));
    }
    const categorySelect = document.getElementById("cat");
    if (!categorySelect) return [];
    const selectedCategory = categorySelect.value;
    return BANK.filter(question => selectedCategory === "all" || question.category === selectedCategory);
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
    // "Νέο τεστ" σημαίνει νέα προσπάθεια, ποτέ αυτόματη συνέχιση.
    // Ο χρήστης επιλέγει "Συνέχεια τεστ" αποκλειστικά από την αρχική.
    if (attemptPending || resultSaving) return;
    attemptPending = true;
    const newQuestions = shuffle(availableQuestions).slice(0, QUESTIONS_PER_TEST);
    const newAnswers = Array(QUESTIONS_PER_TEST).fill(null);
    const payload={id:newTestId(),type:'knowledge',questionIds:newQuestions.map(q=>q.id),answers:newAnswers,position:0,level:0,correct:0,total:0,currentId:'',selected:null,answered:false};
    try {
        // Ολοκλήρωση τυχόν εκκρεμών αποθηκεύσεων του προηγούμενου τεστ.
        if (!await flushProgress()) return;
        const result=await window.StoxosFirebase.beginAttempt(payload, true);
        if (!result.allowed) {showPricing('Έχεις ολοκληρώσει και τα 5 δωρεάν τεστ.');return;}
        test=newQuestions;
        answers=newAnswers;
        position=0;
        knowledgeChecked=false;
        savedAttempt=payload;
        activeTestId=payload.id;
        inductiveActiveTest=false;
        knowledgeResultLogged=false;
        progressError=false;
        show();
    } catch(err) { alert('Δεν ήταν δυνατή η έναρξη: '+(err.message||err)); }
    finally {attemptPending=false;}
}

function show() {
    const question = test[position];
    const selected = answers[position];
    const isCorrect = selected === question.correct;
    const optionsHtml = question.options.map((option, index) => {
        const checked = selected === index ? "checked" : "";
        const feedbackClass = knowledgeChecked
            ? (index === question.correct ? "answer-correct" : (index === selected ? "answer-incorrect" : ""))
            : "";
        return `
            <label class="answer ${feedbackClass}">
                <input type="radio" name="answer" value="${index}"
                       ${checked} ${knowledgeChecked ? 'disabled' : ''} onchange="choose(${index})">
                <b>${ANSWER_LETTERS[index]}.</b> ${escapeHtml(option)}
            </label>
        `;
    }).join("");

    const progress = ((position + 1) / QUESTIONS_PER_TEST) * 100;
    const last = position === QUESTIONS_PER_TEST - 1;
    const actionText = knowledgeChecked ? (last ? "Ολοκλήρωση τεστ" : "Επόμενη") : "Έλεγχος";
    const action = knowledgeChecked ? "next()" : "checkKnowledgeAnswer()";
    const feedback = knowledgeChecked ? `<div class="knowledge-feedback ${isCorrect ? 'knowledge-success' : 'knowledge-error'}" role="status" aria-live="polite">
        <strong>${isCorrect ? 'Σωστή απάντηση!' : `Λάθος απάντηση. Σωστή: ${ANSWER_LETTERS[question.correct]}.`}</strong>
    </div>` : '';
    app.innerHTML = `
        <p class="muted">
            ${escapeHtml(question.category)} · Ερώτηση ${position + 1}
            από ${QUESTIONS_PER_TEST} · Αρχικός αριθμός #${question.id}
        </p>
        <div class="bar"><div class="fill" style="width: ${progress}%"></div></div>
        <h2>${escapeHtml(question.question)}</h2>
        ${optionsHtml}
        ${feedback}
        <div class="actions">
            <button class="secondary" onclick="home()">Αρχική</button>
            <button id="knowledge-action" onclick="${action}" ${!knowledgeChecked && selected === null ? 'disabled' : ''}>${actionText}</button>
        </div>
    `;
}

function choose(index) {
    if (knowledgeChecked || !Number.isInteger(index) || index < 0 || index >= test[position].options.length) return;
    answers[position] = index;
    const button = document.getElementById('knowledge-action');
    if (button) button.disabled = false;
    queueAttemptSave();
}

function checkKnowledgeAnswer() {
    if (knowledgeChecked || answers[position] === null) return;
    knowledgeChecked = true;
    queueAttemptSave();
    show();
}

function prev() {
    // Στη ροή άμεσου ελέγχου οι ήδη ελεγμένες απαντήσεις κλειδώνουν.
    // Δεν επιτρέπεται επιστροφή/αλλαγή παλιότερης απάντησης.
}

function next() {
    if (!knowledgeChecked || resultSaving) return;
    if (position < QUESTIONS_PER_TEST - 1) {
        position++;
        knowledgeChecked = false;
        queueAttemptSave();
        show();
    } else {
        finish();
    }
}

async function finish() {
    if (!knowledgeChecked || resultSaving || knowledgeResultLogged) return;
    const correctCount = test.reduce((total, question, index) => {
        return total + (answers[index] === question.correct ? 1 : 0);
    }, 0);

    const unansweredCount = answers.filter((answer) => answer === null).length;
    const percentage = Math.round((correctCount / QUESTIONS_PER_TEST) * 100);
    if (!await flushProgress()) return;
    if (!await saveTestResult('knowledge', correctCount, QUESTIONS_PER_TEST)) return;
    knowledgeResultLogged = true;

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
    studyCategory=document.getElementById('cat')?.value || 'all';
    studyQuestions = selectedQuestions();

    if (studyQuestions.length === 0) {
        alert("Δεν υπάρχουν ερωτήσεις σε αυτή την κατηγορία.");
        return;
    }

    // Η τιμή είναι η θέση μέσα στις ερωτήσεις της επιλεγμένης κατηγορίας.
    studyPosition = Number(document.getElementById("study-start").value);
    currentStudyKind='knowledge';
    showStudy();
    saveStudyProgress('knowledge');
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
        saveStudyProgress('knowledge');
    }
}

function previousStudy() {
    if (studyPosition > 0) {
        studyPosition--;
        showStudy();
        saveStudyProgress('knowledge');
    }
}

function nextStudy() {
    if (studyPosition < studyQuestions.length - 1) {
        studyPosition++;
        showStudy();
        saveStudyProgress('knowledge');
    } else {
        finishStudyProgress('knowledge');
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
        ${mode === "test" ? `<p class="muted">${premiumDemoEnabled() ? 'Premium: απεριόριστα τεστ.' : `Δωρεάν τεστ που απομένουν: ${freeTestsRemaining()} (κοινό όριο με τα τεστ γνώσεων).`}</p>` : ''}
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
    if (inductiveMode === 'test' && (attemptPending || resultSaving)) return;
    if (inductiveMode === 'test') {
        attemptPending = true;
        try {
            if (!await flushProgress()) return;
        } finally { attemptPending = false; }
    }
    inductiveResultLogged = false;
    activeTestId = null;
    inductiveLevel = 3; // Οριστικό αρχικό επίπεδο για κάθε τεστ.
    if (inductiveMode === "study") {
        currentStudyKind='inductive';
        const value = document.getElementById("inductive-study-level").value;
        inductiveStudyLevel = value === "all" ? "all" : Number(value);
    }
    inductiveSeen = new Set();
    inductiveCorrect = 0;
    inductiveTotal = 0;
    inductiveActiveTest = inductiveMode === 'test';
    if (inductiveActiveTest) {
        const initial=pickNextInductive();
        if (!initial) {alert('Δεν υπάρχουν διαθέσιμα σχήματα.');return;}
        inductiveCurrent=initial; inductiveSeen.add(initial.id); inductiveSelected=null; inductiveAnswered=false;
        const payload={id:newTestId(),type:'inductive',questionIds:[initial.id],answers:[],position:0,level:inductiveLevel,correct:0,total:0,currentId:initial.id,selected:null,answered:false};
        try {
            const result=await window.StoxosFirebase.beginAttempt(payload, true);
            if (!result.allowed) {showPricing('Έχεις ολοκληρώσει και τα 5 δωρεάν τεστ.');return;}
            savedAttempt=payload;
            activeTestId=payload.id;
            progressError=false;
        } catch(err) {alert('Δεν ήταν δυνατή η έναρξη: '+(err.message||err));return;}
        showInductive();
    } else nextInductiveQuestion();
}

function pickNextInductive() {
    const remaining=inductiveBank().filter(q=>!inductiveSeen.has(q.id) && (inductiveMode === 'test' || inductiveStudyLevel === 'all' || q.level === inductiveStudyLevel));
    if (!remaining.length) return null;
    const minDistance=Math.min(...remaining.map(q=>Math.abs(q.level-inductiveLevel)));
    const candidates=inductiveMode === 'study' ? remaining : remaining.filter(q=>Math.abs(q.level-inductiveLevel)===minDistance);
    return candidates[Math.floor(Math.random()*candidates.length)];
}
async function nextInductiveQuestion() {
    if (inductiveActiveTest && !await flushProgress()) return;
    if (resultSaving) return;
    const remaining = inductiveBank().filter(q => !inductiveSeen.has(q.id) && (inductiveMode === "test" || inductiveStudyLevel === "all" || q.level === inductiveStudyLevel));
    const reachedLimit = inductiveMode === "test" && inductiveTotal >= INDUCTIVE_TEST_LENGTH;
    if (reachedLimit || !remaining.length) {
        if (inductiveMode === 'test' && !inductiveResultLogged && inductiveTotal > 0) {
            if (!await saveTestResult('inductive', inductiveCorrect, inductiveTotal)) return;
            inductiveResultLogged = true;
        }
        if (inductiveMode === 'study') finishStudyProgress('inductive');
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
    if (inductiveActiveTest) await queueAttemptSave();
    else if (inductiveMode==='study') saveStudyProgress('inductive');
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
    if (inductiveActiveTest) queueAttemptSave();
    else if (inductiveMode==='study') saveStudyProgress('inductive');
}

function checkInductive() {
    if (inductiveAnswered || inductiveSelected === null) return;
    inductiveAnswered = true;
    inductiveTotal++;
    const correct = inductiveSelected === inductiveCurrent.correct;
    if (correct) inductiveCorrect++;
    // Μεταβολή στόχου κατά ένα επίπεδο, εντός 1-10.
    if (inductiveMode === "test") inductiveLevel = Math.max(1, Math.min(10, inductiveLevel + (correct ? 1 : -1)));
    showInductiveFeedback();
    if (inductiveActiveTest) queueAttemptSave();
    else if (inductiveMode==='study') saveStudyProgress('inductive');
}

function showInductiveFeedback() {
    const correct = inductiveSelected === inductiveCurrent.correct;
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
