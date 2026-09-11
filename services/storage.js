const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'dailyaffairs';
const COLLECTION_NAME = 'questions';

let client = null;
let db = null;
let questionsCollection = null;
let cachedDates = null;
let datesCacheTime = 0;

async function connectDB() {
    if (questionsCollection) return questionsCollection;

    try {
        client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        questionsCollection = db.collection(COLLECTION_NAME);

        await questionsCollection.createIndex({ date: -1 });
        await questionsCollection.createIndex({ date: 1, qno: 1 });

        console.log('[MongoDB] Connected successfully');
        return questionsCollection;
    } catch (error) {
        console.error('[MongoDB] Connection failed:', error.message);
        throw error;
    }
}

async function saveQuestionsForDate(dateStr, translatedQuestions) {
    const collection = await connectDB();

    if (!translatedQuestions || translatedQuestions.length === 0) return;

    await collection.deleteMany({ date: dateStr });

    const shuffled = shuffleQuestions(translatedQuestions, dateStr);

    if (shuffled.length > 0) {
        await collection.insertMany(shuffled);
    }

    // Refresh dates cache
    cachedDates = null;

    console.log(`[MongoDB] Saved ${shuffled.length} questions for ${dateStr}`);
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

async function getAvailableDates(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedDates && (now - datesCacheTime < 60000)) {
        return cachedDates;
    }
    
    const collection = await connectDB();
    const dates = await collection.distinct('date');
    cachedDates = dates.sort().reverse();
    datesCacheTime = now;
    return cachedDates;
}

async function getQuestions(dateStr, lang = 'en', category = null, searchQuery = null) {
    const collection = await connectDB();

    let query = {};
    if (dateStr && dateStr !== 'all') {
        query.date = dateStr;
    } else if (!dateStr) {
        const dates = await getAvailableDates();
        if (dates.length > 0) {
            query.date = dates[0];
        }
    }

    if (category && category !== 'All') {
        query.category = category;
    }

    let list = await collection.find(query).project({ [lang]: 1, en: 1, id: 1, date: 1, qno: 1, category: 1, answer: 1 }).sort({ qno: 1 }).toArray();

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

async function getCategories() {
    const collection = await connectDB();
    const categories = await collection.distinct('category');
    return categories.filter(Boolean);
}

async function getQuestionCount(dateStr) {
    const collection = await connectDB();
    if (dateStr) {
        return await collection.countDocuments({ date: dateStr });
    }
    return await collection.countDocuments();
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
