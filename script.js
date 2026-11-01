// Πρόγραμμα εξάσκησης ΑΣΕΠ.
// Το BANK περιέχει τις ερωτήσεις από το αρχείο questions.js.

const QUESTIONS_PER_TEST = 25;
const ANSWER_LETTERS = ["Α", "Β", "Γ", "Δ"];
const app = document.getElementById("app");

// Δεδομένα για τη λειτουργία Τεστ.
let test = [];
let answers = [];
let position = 0;

// Δεδομένα για τη λειτουργία Εκμάθησης.
let studyQuestions = [];
let studyPosition = 0;

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

// Αρχική οθόνη με τις δύο λειτουργίες.
function home() {
    const categoryCount = new Set(BANK.map((question) => question.category)).size;

    app.innerHTML = `
        <h1>ΑΣΕΠ · Προσωπική εξάσκηση</h1>
        <p class="muted">${BANK.length} ερωτήσεις · ${categoryCount} κατηγορίες</p>

        <h2>Μέρος 1 · Ερωτήσεις γνώσεων</h2>
        <div class="mode-grid">
            <button onclick="selectMode('test')">Τεστ γνώσεων</button>
            <button class="study-button" onclick="selectMode('study')">Εκμάθηση γνώσεων</button>
        </div>
        <hr class="section-divider">
        <h2>Μέρος 2 · Επαγωγικός Συλλογισμός</h2>
        <p class="muted">${INDUCTIVE_QUESTIONS.length} ερωτήσεις · 10 προβλεπόμενα επίπεδα δυσκολίας · διανυσματικά σχήματα SVG</p>
        <div class="mode-grid">
            <button onclick="inductiveMenu('test')">Τεστ σχημάτων</button>
            <button class="study-button" onclick="inductiveMenu('study')">Εκμάθηση σχημάτων</button>
        </div>

        <p class="muted">Τεστ: 25 τυχαίες ερωτήσεις και βαθμολογία.</p>
        <p class="muted">Εκμάθηση: όλες οι ερωτήσεις με τη σωστή απάντηση εμφανή.</p>
    `;
}

// Επιλογή κατηγορίας ανάλογα με τη λειτουργία.
function selectMode(mode) {
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

function start() {
    const availableQuestions = selectedQuestions();

    if (availableQuestions.length < QUESTIONS_PER_TEST) {
        alert(`Χρειάζονται τουλάχιστον ${QUESTIONS_PER_TEST} ερωτήσεις.`);
        return;
    }

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
        <button onclick="home()">Αρχική οθόνη</button>
        <h3>Ανασκόπηση απαντήσεων</h3>
        ${reviewHtml}
    `;
}

// -------------------- ΛΕΙΤΟΥΡΓΙΑ ΕΚΜΑΘΗΣΗΣ --------------------

// Στην εκμάθηση ΔΕΝ ανακατεύουμε και ΔΕΝ περιορίζουμε τις ερωτήσεις.
function startStudy() {
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

// Εκκίνηση του προγράμματος.
home();


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
    inductiveMode = mode;
    const available = inductiveBank();
    const studyLevels = [...new Set(available.map(q => q.level))].sort((a,b)=>a-b);
    app.innerHTML = `
        <h1>Επαγωγικός Συλλογισμός · ${mode === "study" ? "Εκμάθηση" : "Τεστ"}</h1>
        <p class="muted">${available.length} ελεγμένες ερωτήσεις SVG, χωρίς εξωτερικά αρχεία εικόνων.</p>
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
function startInductive() {
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
        app.innerHTML = `
            <h1>Ολοκλήρωση ${inductiveMode === "test" ? "τεστ" : "εκμάθησης"}</h1>
            <h2>${inductiveCorrect} / ${inductiveTotal} σωστές</h2>
            ${reachedLimit ? `<p class="muted">Ολοκληρώθηκαν και οι ${INDUCTIVE_TEST_LENGTH} ερωτήσεις του τεστ.</p><p class="muted">Ποσοστό επιτυχίας: ${Math.round(100 * inductiveCorrect / inductiveTotal)}%</p>` : `<p class="muted">Ολοκληρώθηκαν όλες οι διαθέσιμες ερωτήσεις χωρίς επανάληψη.</p>`}
            <div class="actions"><button class="secondary" onclick="home()">Αρχική</button>
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
