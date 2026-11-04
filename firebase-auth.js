// Firebase JS SDK 13.2.0 — Web, no build step. Συνδέεται με τον υπάρχοντα script.js.
// Τα στοιχεία firebaseConfig είναι δημόσιο configuration, ΟΧΙ server key.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification,
  onAuthStateChanged, signOut, reload, getIdToken
} from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import {
  getFirestore, doc, collection, serverTimestamp, runTransaction, addDoc,
  onSnapshot, query, orderBy, limit
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
let tokenVersion = 0;
const limitFreeTests = 3;

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
  offProfile = null;
  offResults = null;
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
  reserveTest: async () => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
    const ref = doc(db, 'users', user.uid);
    return runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw Error('Δεν έχει δημιουργηθεί το προφίλ χρήστη.');
      const started = snap.data().started;
      if (!Number.isInteger(started) || started >= limitFreeTests) return {allowed:false, started};
      tx.update(ref, {started: started + 1});
      return {allowed:true, started: started + 1};
    });
  },
  saveResult: async (type, correct, total) => {
    const user = auth.currentUser;
    if (!user || !user.emailVerified) throw Error('Δεν είσαι συνδεδεμένος.');
    await addDoc(collection(db, 'users', user.uid, 'results'), {
      type, correct, total, at: serverTimestamp()
    });
  }
};

async function startVerifiedSession(user, version) {
  listenersOff();
  try {
    await ensureProfile(user);
    if (version !== tokenVersion || auth.currentUser?.uid !== user.uid) return;
    window.firebaseAuthChanged?.(user);
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
