// Firebase JS SDK 13.2.0 — Web, no build step. Συνδέεται με τον υπάρχοντα script.js.
// Τα στοιχεία firebaseConfig είναι δημόσιο configuration, ΟΧΙ server key.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  onAuthStateChanged, signOut, reauthenticateWithPopup
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-functions.js';
import {
  getFirestore, doc, collection, serverTimestamp, runTransaction,
  onSnapshot, query, orderBy, limit, updateDoc, getDoc, deleteDoc, setDoc
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDnn-wiOrmjRqFqHC_q404ghPiRHmyeUTY',
  authDomain: 'stoxos-asep.firebaseapp.com',
  projectId: 'stoxos-asep',
  storageBucket: 'stoxos-asep.firebasestorage.app',
  messagingSenderId: '779857092933',
  appId: '1:779857092933:web:0eb1500e75a3cb86391e2c',
  measurementId: 'G-NWF9S4N9LV'
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const functions = getFunctions(firebaseApp, 'europe-west1');
const google = new GoogleAuthProvider();
let offProfile = null;
let offResults = null;
let offAnalytics = null;
let offEntitlement = null;
let offAttempt = null;
let offStudyKnowledge = null;
let offStudyInductive = null;
let tokenVersion = 0;
const limitFreeTests = 5;

async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  // Μόνο δημιουργία: 2 ταυτόχρονες συσκευές δεν πρέπει να μηδενίζουν πρόοδο.
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) tx.set(ref, {started: 0, createdAt: serverTimestamp()});
  });
}

const listenersOff = () => {
  if (offProfile) offProfile();
  if (offResults) offResults();
  if (offAnalytics) offAnalytics();
  if (offEntitlement) offEntitlement();
  if (offAttempt) offAttempt();
  if (offStudyKnowledge) offStudyKnowledge();
  if (offStudyInductive) offStudyInductive();
  offProfile = null;
  offResults = null;
  offAnalytics = null;
  offEntitlement = null;
  offAttempt = null;
  offStudyKnowledge = null;
  offStudyInductive = null;
};

window.StoxosFirebase = {
  observeAuth: callback => onAuthStateChanged(auth, callback),
  deleteAccount: async () => {
    const user = auth.currentUser;
    if (!user) throw Error('Απαιτείται σύνδεση Google.');
    // Google popup verifies that the person requesting deletion owns this account.
    await reauthenticateWithPopup(user, google);
    await user.getIdToken(true);
    const response = await httpsCallable(functions, 'deleteAccount', {timeout: 330000})({});
    if (response.data?.deleted !== true) throw Error('Δεν επιβεβαιώθηκε η διαγραφή.');
    try { await signOut(auth); } catch (err) { console.warn('Sign out after deletion:', err); }
    return true;
  },
  getSubscriptionStatus: async () => {
    if (!auth.currentUser) throw Error('Απαιτείται σύνδεση Google.');
    const result = await httpsCallable(functions, 'getSubscriptionStatus')({});
    return result.data;
  },
  createStripeCheckout: async plan => {
    if (!auth.currentUser) throw Error('Απαιτείται σύνδεση Google.');
    const result = await httpsCallable(functions, 'createStripeCheckout')({plan});
    return result.data?.url;
  },
  createStripePortal: async () => {
    if (!auth.currentUser) throw Error('Απαιτείται σύνδεση Google.');
    const result = await httpsCallable(functions, 'createStripePortal')({});
    return result.data?.url;
  },
  // Η δημιουργία και η σύνδεση λογαριασμού γίνονται αποκλειστικά μέσω Google.
  loginGoogle: () => signInWithPopup(auth, google),
  logout: () => signOut(auth),
  // Η εκμάθηση αποθηκεύεται χωριστά από τα τεστ και δεν καταναλώνει προσπάθειες.
  getStudy: async kind => {
    const user=auth.currentUser;
    if (!user || !['knowledge','inductive'].includes(kind)) throw Error('Δεν επιτρέπεται η ανάκτηση εκμάθησης.');
    const snap=await getDoc(doc(db,'users',user.uid,'study',kind));
    return snap.exists()?snap.data():null;
  },
  saveStudy: async (kind, record) => {
    const user=auth.currentUser;
    if (!user || !['knowledge','inductive'].includes(kind)) throw Error('Δεν επιτρέπεται η αποθήκευση εκμάθησης.');
    return setDoc(doc(db,'users',user.uid,'study',kind), {...record,updatedAt:serverTimestamp()});
  },
  deleteStudy: async kind => {
    const user=auth.currentUser;
    if (!user || !['knowledge','inductive'].includes(kind)) throw Error('Δεν επιτρέπεται η διαγραφή εκμάθησης.');
    return deleteDoc(doc(db,'users',user.uid,'study',kind));
  },
  getAttempt: async () => {
    const user=auth.currentUser;
    if (!user) throw Error('Δεν είσαι συνδεδεμένος.');
    const snap=await getDoc(doc(db,'users',user.uid,'active','current'));
    return snap.exists()?snap.data():null;
  },
  beginAttempt: async (attempt, replaceExisting = false) => {
    const user=auth.currentUser;
    if (!user) throw Error('Δεν είσαι συνδεδεμένος.');
    const profileRef=doc(db,'users',user.uid), entitlementRef=doc(db,'entitlements',user.uid), activeRef=doc(db,'users',user.uid,'active','current');
    return runTransaction(db,async tx=>{
      const profile=await tx.get(profileRef),entitlement=await tx.get(entitlementRef),existing=await tx.get(activeRef);
      if (!profile.exists()) throw Error('Δεν υπάρχει προφίλ.');
      // Ποτέ δεν επαναφέρουμε αυτόματα το προηγούμενο τεστ.
      // Η επαναφορά γίνεται μόνο μέσω getAttempt() από το κουμπί "Συνέχεια τεστ".
      if (existing.exists() && !replaceExisting) return {allowed:true,existing:true,attempt:existing.data()};
      const premium=entitlement.exists() && entitlement.data().premium===true;
      if (!premium && profile.data().started>=limitFreeTests) return {allowed:false};
      // Atomically replace the unfinished attempt; no extra completion charge.
      tx.set(activeRef,{...attempt,updatedAt:serverTimestamp()});
      return {allowed:true,existing:false,attempt};
    });
  },
  updateAttempt: async state => {
    const user=auth.currentUser;
    if (!user) throw Error('Δεν είσαι συνδεδεμένος.');
    return updateDoc(doc(db,'users',user.uid,'active','current'),{...state,updatedAt:serverTimestamp()});
  },
  deleteAttempt: async id => {
    const user=auth.currentUser;
    if (!user) throw Error('Δεν είσαι συνδεδεμένος.');
    return runTransaction(db,async tx=>{
      const ref=doc(db,'users',user.uid,'active','current');
      const snap=await tx.get(ref);
      if (snap.exists() && snap.data().id===id) tx.delete(ref);
    });
  },
  // Δεν χρεώνεται τίποτα κατά την έναρξη. Ελέγχουμε την πρόσβαση στον server.
  canStartTest: async () => {
    const user = auth.currentUser;
    if (!user) throw Error('Δεν είσαι συνδεδεμένος.');
    return runTransaction(db, async tx => {
      const profile = await tx.get(doc(db, 'users', user.uid));
      const entitlement = await tx.get(doc(db, 'entitlements', user.uid));
      if (!profile.exists()) throw Error('Δεν βρέθηκε προφίλ.');
      const premium = entitlement.exists() && entitlement.data().premium === true;
      const completed = profile.data().started;
      if (!Number.isInteger(completed) || completed < 0) throw Error('Μη έγκυρος μετρητής.');
      return {allowed: premium || completed < limitFreeTests, premium, completed};
    });
  },
  // Ατομική συναλλαγή: αποτέλεσμα + μετρητής ολοκλήρωσης μαζί.
  // Σημαντικό: οι βαθμολογίες παράγονται στον client, όχι σε έμπιστο server.
  saveResult: async (type, correct, total, submissionId, breakdown = null) => {
    const user = auth.currentUser;
    if (!user) throw Error('Δεν είσαι συνδεδεμένος.');
    if (!['knowledge', 'inductive'].includes(type) || !Number.isInteger(correct) ||
        !Number.isInteger(total) || (type === 'knowledge' && total !== 25) ||
        (type === 'inductive' && total !== 18) || correct < 0 || correct > total) {
      throw Error('Μη έγκυρο αποτέλεσμα.');
    }
    if (!/^[a-f0-9-]{36}$/.test(submissionId || '')) throw Error('Μη έγκυρη προσπάθεια.');
    const categoryCorrect = type === 'knowledge' ? breakdown?.categoryCorrect : Array(11).fill(0);
    const categoryTotal = type === 'knowledge' ? breakdown?.categoryTotal : Array(11).fill(0);
    const valid = arr => Array.isArray(arr) && arr.length === 11 &&
      arr.every(v => Number.isInteger(v) && v >= 0 && v <= 25);
    if (!valid(categoryCorrect) || !valid(categoryTotal) ||
        categoryCorrect.some((v,i) => v > categoryTotal[i]) ||
        categoryCorrect.reduce((sum,n)=>sum+n,0) !== (type === 'knowledge' ? correct : 0) ||
        categoryTotal.reduce((sum,n)=>sum+n,0) !== (type === 'knowledge' ? total : 0)) {
      throw Error('Η ανάλυση κατηγοριών δεν συμφωνεί με το αποτέλεσμα.');
    }
    // Οι listeners εκμάθησης ενεργοποιούνται μόνο στο startVerifiedSession.
    // Η αποθήκευση αποτελέσματος δεν πρέπει να δημιουργεί νέες συνδρομές Firestore.
    const profileRef = doc(db, 'users', user.uid);
    const entitlementRef = doc(db, 'entitlements', user.uid);
    const activeRef = doc(db, 'users', user.uid, 'active', 'current');
    const analyticsRef = doc(db, 'users', user.uid, 'stats', 'overview');
    return runTransaction(db, async tx => {
      // Όλες οι αναγνώσεις προηγούνται των εγγραφών στο Firestore transaction.
      const profile = await tx.get(profileRef);
      const entitlement = await tx.get(entitlementRef);
      const active = await tx.get(activeRef);
      const analytics = await tx.get(analyticsRef);
      if (!active.exists() || active.data().id !== submissionId || active.data().type !== type) throw Error('Δεν βρέθηκε η ενεργή προσπάθεια.');
      if (!profile.exists()) throw Error('Το προφίλ δεν υπάρχει.');
      const premium = entitlement.exists() && entitlement.data().premium === true;
      const completed = profile.data().started;
      if (!Number.isInteger(completed) || completed < 0) throw Error('Μη έγκυρος μετρητής.');
      if (!premium && completed >= limitFreeTests) throw Error('Δεν απομένουν δωρεάν ολοκληρώσεις.');
      const resultId = premium ? `premium-${submissionId}` : `completed-${completed + 1}`;
      const resultRef = doc(db, 'users', user.uid, 'results', resultId);
      const existing = await tx.get(resultRef);
      if (existing.exists()) throw Error('Το αποτέλεσμα καταχωρίστηκε ήδη.');
      const previous = analytics.exists() && analytics.data().schema === 1 ? analytics.data() : null;
      const zero = () => Array(11).fill(0);
      const previousCorrect = Array.isArray(previous?.categoryCorrect) && previous.categoryCorrect.length === 11 ? previous.categoryCorrect : zero();
      const previousTotal = Array.isArray(previous?.categoryTotal) && previous.categoryTotal.length === 11 ? previous.categoryTotal : zero();
      const nextAnalytics = {
        schema: 1,
        knowledgeTests: (previous?.knowledgeTests || 0) + (type === 'knowledge' ? 1 : 0),
        knowledgeCorrect: (previous?.knowledgeCorrect || 0) + (type === 'knowledge' ? correct : 0),
        knowledgeTotal: (previous?.knowledgeTotal || 0) + (type === 'knowledge' ? total : 0),
        knowledgeBest: Math.max(previous?.knowledgeBest || 0, type === 'knowledge' ? Math.round(correct * 100 / total) : 0),
        inductiveTests: (previous?.inductiveTests || 0) + (type === 'inductive' ? 1 : 0),
        inductiveCorrect: (previous?.inductiveCorrect || 0) + (type === 'inductive' ? correct : 0),
        inductiveTotal: (previous?.inductiveTotal || 0) + (type === 'inductive' ? total : 0),
        inductiveBest: Math.max(previous?.inductiveBest || 0, type === 'inductive' ? Math.round(correct * 100 / total) : 0),
        categoryCorrect: previousCorrect.map((n,i) => n + categoryCorrect[i]),
        categoryTotal: previousTotal.map((n,i) => n + categoryTotal[i]),
        createdAt: previous?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      tx.set(resultRef, {type, correct, total, categoryCorrect, categoryTotal, at: serverTimestamp()});
      tx.set(analyticsRef, nextAnalytics);
      if (!premium) tx.update(profileRef, {started: completed + 1});
      tx.delete(activeRef);
      return {premium, completed: premium ? completed : completed + 1};
    });
  }

};

async function startVerifiedSession(user, version) {
  listenersOff();
  try {
    await ensureProfile(user);
    if (version !== tokenVersion || auth.currentUser?.uid !== user.uid) return;
    window.firebaseAuthChanged?.(user);
    const activeRef=doc(db,'users',user.uid,'active','current');
    offAttempt=onSnapshot(activeRef,snap=>window.firebaseAttemptChanged?.(snap.exists()?snap.data():null),err=>console.warn('Πρόοδος τεστ:',err));
    offStudyKnowledge=onSnapshot(doc(db,'users',user.uid,'study','knowledge'),
      snap=>window.firebaseStudyChanged?.('knowledge',snap.exists()?snap.data():null),
      err=>console.warn('Πρόοδος εκμάθησης γνώσεων:',err));
    offStudyInductive=onSnapshot(doc(db,'users',user.uid,'study','inductive'),
      snap=>window.firebaseStudyChanged?.('inductive',snap.exists()?snap.data():null),
      err=>console.warn('Πρόοδος εκμάθησης σχημάτων:',err));
    const entitlementRef = doc(db, 'entitlements', user.uid);
    offEntitlement = onSnapshot(entitlementRef,
      snap => window.firebasePremiumChanged?.(snap.exists() && snap.data().premium === true),
      err => window.firebaseSetupError?.('Δεν επιτρέπεται ανάγνωση δικαιωμάτων: ' + err.message)
    );
    const profile = doc(db, 'users', user.uid);
    offProfile = onSnapshot(profile,
      snap => window.firebaseQuotaChanged?.(snap.exists() ? snap.data().started : 0),
      err => window.firebaseSetupError?.('Δεν επιτρέπεται ανάγνωση του προφίλ: ' + err.message)
    );
    offAnalytics = onSnapshot(doc(db, 'users', user.uid, 'stats', 'overview'),
      snap => window.firebaseAnalyticsChanged?.(snap.exists() ? snap.data() : null),
      err => console.warn('Συγκεντρωτικά στατιστικά:', err)
    );
    const resultsQuery = query(collection(db, 'users', user.uid, 'results'), orderBy('at', 'desc'), limit(50));
    offResults = onSnapshot(resultsQuery,
      snap => window.firebaseResultsChanged?.(snap.docs.map(d => ({
        type: d.data().type, correct: d.data().correct, total: d.data().total,
        categoryCorrect: d.data().categoryCorrect || null,
        categoryTotal: d.data().categoryTotal || null,
        at: d.data().at?.toDate?.()?.toISOString() || new Date().toISOString()
      }))),
      err => console.warn('Firestore αποτελέσματα:', err)
    );
  } catch (err) {
    if (version === tokenVersion) window.firebaseSetupError?.(err.message || String(err));
  }
}

onAuthStateChanged(auth, user => {
  const version = ++tokenVersion;
  listenersOff();
  if (!user) {
    window.firebaseAuthChanged?.(user || null);
    return;
  }
  startVerifiedSession(user, version);
}, err => window.firebaseSetupError?.(err.message || String(err)));
