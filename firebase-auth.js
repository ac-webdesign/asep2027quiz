// Firebase JS SDK 13.2.0 — Web, no build step. Συνδέεται με τον υπάρχοντα script.js.
// Τα στοιχεία firebaseConfig είναι δημόσιο configuration, ΟΧΙ server key.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification,
  onAuthStateChanged, signOut, reload, getIdToken
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
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
const google = new GoogleAuthProvider();
let offProfile = null;
let offResults = null;
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
  if (offEntitlement) offEntitlement();
  if (offAttempt) offAttempt();
  if (offStudyKnowledge) offStudyKnowledge();
  if (offStudyInductive) offStudyInductive();
  offProfile = null;
  offResults = null;
  offEntitlement = null;
  offAttempt = null;
  offStudyKnowledge = null;
  offStudyInductive = null;
};

window.StoxosFirebase = {
  loginGoogle: () => signInWithPopup(auth, google),
  loginEmail: async (email, password, register) => {
    if (register) {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      return result;
    }
    return signInWithEmailAndPassword(auth, email, password);
  },
  logout: () => signOut(auth),
  checkEmailVerified: async () => {
    if (!auth.currentUser) return false;
    await reload(auth.currentUser);
    if (auth.currentUser.emailVerified) {
      await getIdToken(auth.currentUser, true);
      await startVerifiedSession(auth.currentUser, ++tokenVersion);
      return true;
    }
    return false;
  },
  resendVerification: () => {
    if (!auth.currentUser) throw Error('Δεν υπάρχει συνδεδεμένος λογαριασμός.');
    return sendEmailVerification(auth.currentUser);
  },
  // Η εκμάθηση αποθηκεύεται χωριστά από τα τεστ και δεν καταναλώνει προσπάθειες.
  getStudy: async kind => {
    const user=auth.currentUser;
    if (!user || !user.emailVerified || !['knowledge','inductive'].includes(kind)) throw Error('Δεν επιτρέπεται η ανάκτηση εκμάθησης.');
    const snap=await getDoc(doc(db,'users',user.uid,'study',kind));
    return snap.exists()?snap.data():null;
  },
  saveStudy: async (kind, record) => {
    const user=auth.currentUser;
    if (!user || !user.emailVerified || !['knowledge','inductive'].includes(kind)) throw Error('Δεν επιτρέπεται η αποθήκευση εκμάθησης.');
    return setDoc(doc(db,'users',user.uid,'study',kind), {...record,updatedAt:serverTimestamp()});
  },
  deleteStudy: async kind => {
    const user=auth.currentUser;
    if (!user || !user.emailVerified || !['knowledge','inductive'].includes(kind)) throw Error('Δεν επιτρέπεται η διαγραφή εκμάθησης.');
    return deleteDoc(doc(db,'users',user.uid,'study',kind));
  },
  getAttempt: async () => {
    const user=auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
    const snap=await getDoc(doc(db,'users',user.uid,'active','current'));
    return snap.exists()?snap.data():null;
  },
  beginAttempt: async (attempt, replaceExisting = false) => {
    const user=auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
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
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
    return updateDoc(doc(db,'users',user.uid,'active','current'),{...state,updatedAt:serverTimestamp()});
  },
  deleteAttempt: async id => {
    const user=auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
    return runTransaction(db,async tx=>{
      const ref=doc(db,'users',user.uid,'active','current');
      const snap=await tx.get(ref);
      if (snap.exists() && snap.data().id===id) tx.delete(ref);
    });
  },
  // Δεν χρεώνεται τίποτα κατά την έναρξη. Ελέγχουμε την πρόσβαση στον server.
  canStartTest: async () => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
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
  saveResult: async (type, correct, total, submissionId) => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
    if (!['knowledge', 'inductive'].includes(type) || !Number.isInteger(correct) ||
        !Number.isInteger(total) || (type === 'knowledge' && total !== 25) ||
        (type === 'inductive' && total !== 18) || correct < 0 || correct > total) {
      throw Error('Μη έγκυρο αποτέλεσμα.');
    }
    if (!/^[a-f0-9-]{36}$/.test(submissionId || '')) throw Error('Μη έγκυρη προσπάθεια.');
    const profileRef = doc(db, 'users', user.uid);
    offStudyKnowledge=onSnapshot(doc(db,'users',user.uid,'study','knowledge'),
      snap=>window.firebaseStudyChanged?.('knowledge',snap.exists()?snap.data():null),
      err=>console.warn('Πρόοδος εκμάθησης γνώσεων:',err));
    offStudyInductive=onSnapshot(doc(db,'users',user.uid,'study','inductive'),
      snap=>window.firebaseStudyChanged?.('inductive',snap.exists()?snap.data():null),
      err=>console.warn('Πρόοδος εκμάθησης σχημάτων:',err));
    const entitlementRef = doc(db, 'entitlements', user.uid);
    const activeRef = doc(db, 'users', user.uid, 'active', 'current');
    return runTransaction(db, async tx => {
      const profile = await tx.get(profileRef);
      const entitlement = await tx.get(entitlementRef);
      const active = await tx.get(activeRef);
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
      tx.set(resultRef, {type, correct, total, at: serverTimestamp()});
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
    const resultsQuery = query(collection(db, 'users', user.uid, 'results'), orderBy('at', 'desc'), limit(50));
    offResults = onSnapshot(resultsQuery,
      snap => window.firebaseResultsChanged?.(snap.docs.map(d => ({
        type: d.data().type, correct: d.data().correct, total: d.data().total,
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
  if (!user || !user.emailVerified) {
    window.firebaseAuthChanged?.(user || null);
    return;
  }
  startVerifiedSession(user, version);
}, err => window.firebaseSetupError?.(err.message || String(err)));
