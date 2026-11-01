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

        <div class="mode-grid">
            <button onclick="selectMode('test')">Τεστ</button>
            <button class="study-button" onclick="selectMode('study')">Εκμάθηση</button>
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
