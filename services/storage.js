const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Memory cache
let dbData = {
    dates: [],
    questions: [] // Array of translated question items
};

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
            dbData = JSON.parse(fileContent);
        } catch (e) {
            console.error('Failed to parse current_affairs.json:', e.message);
        }
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save current_affairs.json:', e.message);
    }
}

// Initial load
loadData();

/**
 * Fisher-Yates Shuffle for questions list per date
 * Ensures IndiaBIX Q1 is never Q1 in our app if total questions > 1
 */
function shuffleQuestions(questions, dateStr) {
    if (!questions || questions.length <= 1) return questions;

    const originalFirstQuestion = questions[0]?.en?.question || questions[0]?.question;
    const list = [...questions];

    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    const currentFirstQuestion = list[0]?.en?.question || list[0]?.question;
    if (list.length > 1 && originalFirstQuestion && currentFirstQuestion === originalFirstQuestion) {
        const targetIdx = Math.floor(Math.random() * (list.length - 1)) + 1;
        [list[0], list[targetIdx]] = [list[targetIdx], list[0]];
    }

    list.forEach((q, idx) => {
        q.qno = idx + 1;
        if (dateStr) {
            q.id = `${dateStr}-${idx + 1}`;
        }
    });

    return list;
}

/**
 * Save or update questions for a specific date (automatically shuffled)
 */
function saveQuestionsForDate(dateStr, translatedQuestions) {
    loadData(); // Re-sync from disk first

    if (!translatedQuestions || translatedQuestions.length === 0) return;

    // Filter out existing questions for this date
    dbData.questions = dbData.questions.filter(q => q.date !== dateStr);

    // Shuffle new questions before saving
    const shuffled = shuffleQuestions(translatedQuestions, dateStr);

    // Push new questions
    dbData.questions.push(...shuffled);

    // Update dates list (sorted descending)
    if (!dbData.dates.includes(dateStr)) {
        dbData.dates.push(dateStr);
        dbData.dates.sort().reverse();
    }

    saveData();
}

/**
 * Shuffle all existing questions in database for all dates
 */
function shuffleAllExistingQuestions() {
    loadData();
    let updatedQuestions = [];

    for (const dateStr of dbData.dates) {
        const dateQuestions = dbData.questions.filter(q => q.date === dateStr);
        if (dateQuestions.length > 0) {
            const shuffled = shuffleQuestions(dateQuestions, dateStr);
            updatedQuestions.push(...shuffled);
        }
    }

    dbData.questions = updatedQuestions;
    saveData();
    console.log(`✅ Shuffled existing questions for ${dbData.dates.length} dates in DB.`);
}

/**
 * Get available dates
 */
function getAvailableDates() {
    loadData(); // Re-read from disk to get latest changes
    return dbData.dates || [];
}

/**
 * Get questions by date & language
 */
function getQuestions(dateStr, lang = 'en', category = null, searchQuery = null) {
    loadData(); // Re-read from disk
    let list = dbData.questions;

    if (dateStr && dateStr !== 'all') {
        list = list.filter(q => q.date === dateStr);
    } else if (!dateStr && dbData.dates.length > 0) {
        // Default to latest date if not specified
        const latestDate = dbData.dates[0];
        list = list.filter(q => q.date === latestDate);
    }

    if (category && category !== 'All') {
        list = list.filter(q => q.category && q.category.toLowerCase() === category.toLowerCase());
    }

    // Format output for requested language ('en', 'hi', 'gu')
    const formatted = list.map(q => {
        const langContent = q[lang] || q['en'];
        const fallbackEn = q['en'] || {};

        return {
            id: q.id,
            date: q.date,
            qno: q.qno,
            category: q.category,
            answer: q.answer,
            question: langContent.question || fallbackEn.question,
            options: langContent.options || fallbackEn.options,
            explanation: langContent.explanation || fallbackEn.explanation
        };
    });

    if (searchQuery) {
        const qLower = searchQuery.toLowerCase();
        return formatted.filter(item => 
            (item.question && item.question.toLowerCase().includes(qLower)) ||
            (item.explanation && item.explanation.toLowerCase().includes(qLower))
        );
    }

    return formatted;
}

/**
 * Get categories list
 */
function getCategories() {
    loadData();
    const categoriesSet = new Set();
    dbData.questions.forEach(q => {
        if (q.category) categoriesSet.add(q.category);
    });
    return Array.from(categoriesSet);
}

module.exports = {
    loadData,
    saveData,
    saveQuestionsForDate,
    shuffleQuestions,
    shuffleAllExistingQuestions,
    getAvailableDates,
    getQuestions,
    getCategories
};
