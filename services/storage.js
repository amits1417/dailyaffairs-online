const fs = require('fs');
const path = require('path');

let MongoClient = null;
try {
    MongoClient = require('mongodb').MongoClient;
} catch (e) {
    MongoClient = null;
}

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'dailyaffairs';
const COLLECTION_NAME = 'questions';

let client = null;
let db = null;
let questionsCollection = null;
let cachedDates = null;
let datesCacheTime = 0;

// Local JSON File Memory Cache
let fileDbData = null;
function loadFileData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            fileDbData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        } catch (e) {
            console.error('Failed to parse current_affairs.json:', e.message);
        }
    }
    if (!fileDbData) {
        fileDbData = { dates: [], questions: [] };
    }
    return fileDbData;
}

function saveFileData() {
    try {
        if (fileDbData) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(fileDbData, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('Failed to save current_affairs.json:', e.message);
    }
}

// In-memory questions cache: key = date|lang|category|month|search -> { data, time }
let questionsCache = new Map();
const QUESTIONS_CACHE_TTL = 5 * 60 * 1000;
const QUESTIONS_CACHE_MAX = 200;

function getQuestionsCacheKey(dateStr, lang, category, month, searchQuery) {
    return `${dateStr || ''}|${lang || 'en'}|${category || ''}|${month || ''}|${searchQuery || ''}`;
}

function setQuestionsCache(key, data) {
    if (questionsCache.size >= QUESTIONS_CACHE_MAX) {
        const oldest = questionsCache.keys().next().value;
        questionsCache.delete(oldest);
    }
    questionsCache.set(key, { data, time: Date.now() });
}

async function connectDB() {
    if (questionsCollection) return questionsCollection;
    if (!MongoClient || !MONGO_URI) {
        console.log('[Storage] Running in Local JSON file mode.');
        return null;
    }

    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        questionsCollection = db.collection(COLLECTION_NAME);

        await questionsCollection.createIndex({ date: -1 });
        await questionsCollection.createIndex({ date: 1, qno: 1 });

        console.log('[MongoDB] Connected successfully');

        // Auto-seed from JSON file if MongoDB collection is empty
        const count = await questionsCollection.countDocuments();
        if (count === 0) {
            const local = loadFileData();
            if (local.questions && local.questions.length > 0) {
                console.log(`[MongoDB] Initializing collection with ${local.questions.length} questions from JSON file...`);
                await questionsCollection.insertMany(local.questions);
            }
        }

        return questionsCollection;
    } catch (error) {
        console.warn('[MongoDB] Connection failed, falling back to JSON file:', error.message);
        questionsCollection = null;
        return null;
    }
}

function shuffleQuestions(questions, dateStr) {
    if (!questions || questions.length <= 1) return questions;

    const list = [...questions];

    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    list.forEach((q, idx) => {
        q.qno = idx + 1;
        if (dateStr) {
            q.id = `${dateStr}-${idx + 1}`;
        }
    });

    return list;
}

async function saveQuestionsForDate(dateStr, translatedQuestions) {
    if (!translatedQuestions || translatedQuestions.length === 0) return;

    const shuffled = shuffleQuestions(translatedQuestions, dateStr);

    const collection = await connectDB();
    if (collection) {
        await collection.deleteMany({ date: dateStr });
        if (shuffled.length > 0) {
            await collection.insertMany(shuffled);
        }
        console.log(`[MongoDB] Saved ${shuffled.length} questions for ${dateStr}`);
    }

    // Always update local file as well
    loadFileData();
    fileDbData.questions = (fileDbData.questions || []).filter(q => q.date !== dateStr);
    fileDbData.questions.push(...shuffled);
    if (!fileDbData.dates.includes(dateStr)) {
        fileDbData.dates.push(dateStr);
        fileDbData.dates.sort().reverse();
    }
    saveFileData();

    cachedDates = null;
    questionsCache.clear();
}

async function getAvailableDates(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedDates && (now - datesCacheTime < 60000)) {
        return cachedDates;
    }

    try {
        const collection = await connectDB();
        if (collection) {
            const dates = await collection.distinct('date');
            cachedDates = dates.sort().reverse();
            datesCacheTime = now;
            return cachedDates;
        }
    } catch (e) {
        console.warn('[Storage] getAvailableDates Mongo fallback:', e.message);
    }

    const local = loadFileData();
    cachedDates = (local.dates || []).sort().reverse();
    datesCacheTime = now;
    return cachedDates;
}

async function getQuestions(dateStr, lang = 'en', category = null, searchQuery = null, month = null) {
    const cacheKey = getQuestionsCacheKey(dateStr, lang, category, month, searchQuery);
    const cached = questionsCache.get(cacheKey);
    if (cached && (Date.now() - cached.time < QUESTIONS_CACHE_TTL)) {
        return cached.data;
    }

    let list = [];
    try {
        const collection = await connectDB();
        if (collection) {
            let query = {};
            if (month && month !== 'All') {
                const [y, m] = month.split('-').map(Number);
                const nextM = m === 12 ? 1 : m + 1;
                const nextY = m === 12 ? y + 1 : y;
                const start = `${y}-${String(m).padStart(2, '0')}-01`;
                const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
                query.date = { $gte: start, $lt: end };
            } else if (dateStr && dateStr !== 'all') {
                query.date = dateStr;
            } else if (!dateStr) {
                const dates = await getAvailableDates();
                if (dates.length > 0) query.date = dates[0];
            }

            if (category && category !== 'All') {
                query.category = category;
            }

            list = await collection.find(query).project({ [lang]: 1, en: 1, id: 1, date: 1, qno: 1, category: 1, answer: 1 }).sort({ qno: 1 }).toArray();
        }
    } catch (e) {
        console.warn('[Storage] getQuestions Mongo fallback:', e.message);
    }

    // If MongoDB didn't return or isn't connected, read from local file
    if (!list || list.length === 0) {
        const local = loadFileData();
        let fileList = local.questions || [];

        if (month && month !== 'All') {
            fileList = fileList.filter(q => q.date && q.date.startsWith(month));
        } else if (dateStr && dateStr !== 'all') {
            fileList = fileList.filter(q => q.date === dateStr);
        } else if (!dateStr && local.dates && local.dates.length > 0) {
            fileList = fileList.filter(q => q.date === local.dates[0]);
        }

        if (category && category !== 'All') {
            fileList = fileList.filter(q => q.category && q.category.toLowerCase() === category.toLowerCase());
        }

        list = fileList;
    }

    const formatted = list.map(q => {
        const langContent = q[lang] || q['en'];
        const fallbackEn = q['en'] || {};

        return {
            id: q.id,
            date: q.date,
            qno: q.qno,
            category: q.category,
            answer: q.answer,
            question: langContent?.question || fallbackEn?.question || '',
            options: langContent?.options || fallbackEn?.options || {},
            explanation: langContent?.explanation || fallbackEn?.explanation || ''
        };
    });

    if (searchQuery) {
        const qLower = searchQuery.toLowerCase();
        const filtered = formatted.filter(item =>
            (item.question && item.question.toLowerCase().includes(qLower)) ||
            (item.explanation && item.explanation.toLowerCase().includes(qLower))
        );
        setQuestionsCache(cacheKey, filtered);
        return filtered;
    }

    setQuestionsCache(cacheKey, formatted);
    return formatted;
}

async function getCategories() {
    try {
        const collection = await connectDB();
        if (collection) {
            const categories = await collection.distinct('category');
            if (categories && categories.length > 0) return categories.filter(Boolean);
        }
    } catch (e) {}

    const local = loadFileData();
    const categoriesSet = new Set();
    (local.questions || []).forEach(q => {
        if (q.category) categoriesSet.add(q.category);
    });
    return Array.from(categoriesSet);
}

async function getQuestionCount(dateStr) {
    try {
        const collection = await connectDB();
        if (collection) {
            if (dateStr) return await collection.countDocuments({ date: dateStr });
            return await collection.countDocuments();
        }
    } catch (e) {}

    const local = loadFileData();
    if (dateStr) {
        return (local.questions || []).filter(q => q.date === dateStr).length;
    }
    return (local.questions || []).length;
}

module.exports = {
    connectDB,
    saveQuestionsForDate,
    shuffleQuestions,
    getAvailableDates,
    getQuestions,
    getCategories,
    getQuestionCount
};
