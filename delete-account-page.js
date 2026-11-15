// Standalone Google-authenticated account deletion page for Play Console.
import './firebase-auth.js';
const api = window.StoxosFirebase;
const target = document.getElementById('public-delete-app');
let currentUid = null;
let deleting = false;

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function renderUser(user) {
  currentUid = user?.uid || null;
  if (deleting) return;
  if (!user) {
    target.innerHTML = `<p>Δεν έχεις συνδεθεί με Google.</p><button id="public-google-login">Σύνδεση με Google</button><p class="legal-small">Θα χρησιμοποιηθεί μόνο ο λογαριασμός που επιλέγεις.</p><p id="public-delete-status" role="status"></p>`;
    document.getElementById('public-google-login').addEventListener('click', async () => {
      try { await api.loginGoogle(); } catch (err) { showStatus(err?.message || 'Δεν ολοκληρώθηκε η σύνδεση.'); }
    });
    return;
  }
  target.innerHTML = `<p>Συνδεδεμένος λογαριασμός: <strong>${escapeText(user.email || '')}</strong></p>
    <label class="deletion-input-label" for="public-delete-word">Γράψε <strong>ΔΙΑΓΡΑΦΗ</strong> για επιβεβαίωση</label>
    <input id="public-delete-word" class="deletion-confirm-input" autocomplete="off" spellcheck="false" placeholder="ΔΙΑΓΡΑΦΗ">
    <label class="deletion-consent"><input id="public-delete-check" type="checkbox"><span>Κατανοώ ότι η διαγραφή είναι οριστική και ακυρώνει αμέσως τυχόν ενεργή συνδρομή Stripe.</span></label>
    <button id="public-delete-button" class="danger-action" disabled>Οριστική διαγραφή λογαριασμού</button>
    <button type="button" id="public-change-account" class="secondary">Αλλαγή Google λογαριασμού</button>
    <p id="public-delete-status" role="status" aria-live="polite"></p>`;
  document.getElementById('public-change-account').addEventListener('click', () => api.logout().catch(err => showStatus(err?.message || 'Δεν έγινε αποσύνδεση.')));
  const button = document.getElementById('public-delete-button');
  const update=()=>button.disabled=deleting || document.getElementById('public-delete-word').value.trim()!=='ΔΙΑΓΡΑΦΗ' || !document.getElementById('public-delete-check').checked;
  document.getElementById('public-delete-word').addEventListener('input',update);
  document.getElementById('public-delete-check').addEventListener('change',update);
  button.addEventListener('click',async()=>{
    if (deleting || button.disabled) return;
    if (!confirm('Τελική επιβεβαίωση: οριστική διαγραφή του λογαριασμού και άμεση ακύρωση τυχόν συνδρομής Stripe;')) return;
    deleting=true;button.disabled=true;
    showStatus('Επιβεβαίωσε ξανά το Google account στο αναδυόμενο παράθυρο. Η διαδικασία ενδέχεται να χρειαστεί χρόνο.');
    try {
      await api.deleteAccount();
      target.innerHTML='<p role="status" class="legal-success"><strong>Ο λογαριασμός ΣΤΟΧΟΣ διαγράφηκε.</strong> Η διαδικασία ολοκληρώθηκε.</p>';
    } catch(err) {
      deleting=false;button.disabled=false;
      showStatus('Δεν ολοκληρώθηκε η διαγραφή: '+(err?.message||'Δοκίμασε ξανά.'));
    }
  });
}
function showStatus(value) { const el = document.getElementById('public-delete-status'); if (el) el.textContent=value; }
api.observeAuth(renderUser);
