const fs = require('fs');
const path = require('path');

let MongoClient = null;
try {
    MongoClient = require('mongodb').MongoClient;
} catch (e) {
    MongoClient = null;
}

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'dailyaffairs';
const COLLECTION_NAME = 'questions';
const USERS_COLLECTION_NAME = 'users';

let client = null;
let db = null;
let questionsCollection = null;
let usersCollection = null;
let cachedDates = null;
let datesCacheTime = 0;

// Local Users File Memory Cache
let usersFileData = null;
function loadUsersData() {
    if (fs.existsSync(USERS_FILE)) {
        try {
            usersFileData = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        } catch (e) {
            console.error('Failed to parse users.json:', e.message);
        }
    }
    if (!usersFileData || !Array.isArray(usersFileData.users)) {
        usersFileData = { users: [] };
    }
    return usersFileData;
}

function saveUsersData() {
    try {
        if (usersFileData) {
            fs.writeFileSync(USERS_FILE, JSON.stringify(usersFileData, null, 2), 'utf8');
        }
    } catch (e) {
        console.error('Failed to save users.json:', e.message);
    }
}

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

function getTodayIST() {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
}

async function connectDB() {
    if (questionsCollection && usersCollection) return questionsCollection;

    try {
        if (!MongoClient || !MONGO_URI) {
            return null;
        }

        if (!client) {
            client = new MongoClient(MONGO_URI);
            await client.connect();
            db = client.db(DB_NAME);
            questionsCollection = db.collection(COLLECTION_NAME);
            usersCollection = db.collection(USERS_COLLECTION_NAME);
        } else {
            questionsCollection = db.collection(COLLECTION_NAME);
            usersCollection = db.collection(USERS_COLLECTION_NAME);
        }

        await questionsCollection.createIndex({ date: 1 }).catch(() => {});
        await questionsCollection.createIndex({ category: 1 }).catch(() => {});
        await usersCollection.createIndex({ phone: 1 }, { unique: true }).catch(() => {});

        // Auto-purge any rogue future dated questions
        const todayStr = getTodayIST();
        await questionsCollection.deleteMany({ date: { $gt: todayStr } }).catch(() => {});

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
        usersCollection = null;
        return null;
    }
}

async function connectUsersDB() {
    if (usersCollection) return usersCollection;
    await connectDB();
    return usersCollection;
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

    const todayStr = getTodayIST();
    if (dateStr > todayStr) {
        console.warn(`[Storage] Rejected saving questions for future date ${dateStr} (today is ${todayStr})`);
        return;
    }

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
    fileDbData.questions = (fileDbData.questions || []).filter(q => q.date !== dateStr && q.date <= todayStr);
    fileDbData.questions.push(...shuffled);
    if (!fileDbData.dates.includes(dateStr) && dateStr <= todayStr) {
        fileDbData.dates.push(dateStr);
    }
    fileDbData.dates = fileDbData.dates.filter(d => d <= todayStr).sort().reverse();
    saveFileData();

    cachedDates = null;
    questionsCache.clear();
}

async function getAvailableDates(forceRefresh = false) {
    const now = Date.now();
    const todayStr = getTodayIST();
    if (!forceRefresh && cachedDates && (now - datesCacheTime < 60000)) {
        return cachedDates.filter(d => d <= todayStr);
    }

    try {
        const collection = await connectDB();
        if (collection) {
            const dates = await collection.distinct('date');
            cachedDates = dates.filter(d => d && d <= todayStr).sort().reverse();
            datesCacheTime = now;
            return cachedDates;
        }
    } catch (e) {
        console.warn('[Storage] getAvailableDates Mongo fallback:', e.message);
    }

    const local = loadFileData();
    cachedDates = (local.dates || []).filter(d => d && d <= todayStr).sort().reverse();
    datesCacheTime = now;
    return cachedDates;
}

async function syncJsonToMongo() {
    try {
        if (!MongoClient || !MONGO_URI) return { status: 'skipped', reason: 'no_mongo' };
        const collection = await connectDB();
        if (!collection) return { status: 'skipped', reason: 'db_not_connected' };

        const local = loadFileData();
        if (!local.questions || local.questions.length === 0) return { status: 'skipped', reason: 'empty_json' };

        const byDate = {};
        for (const q of local.questions) {
            if (!q.date) continue;
            if (!byDate[q.date]) byDate[q.date] = [];
            byDate[q.date].push(q);
        }

        let updatedDates = 0;
        let insertedQ = 0;

        for (const [dateStr, qList] of Object.entries(byDate)) {
            const mongoCount = await collection.countDocuments({ date: dateStr });
            if (mongoCount < qList.length) {
                await collection.deleteMany({ date: dateStr });
                await collection.insertMany(qList);
                updatedDates++;
                insertedQ += qList.length;
            }
        }

        console.log(`[Storage] Synced ${updatedDates} dates (${insertedQ} questions) from JSON into MongoDB.`);
        cachedDates = null;
        questionsCache.clear();
        return { status: 'success', updatedDates, insertedQ };
    } catch (err) {
        console.error('[Storage] syncJsonToMongo error:', err.message);
        return { status: 'error', error: err.message };
    }
}

async function getQuestions(dateStr, lang = 'en', category = null, searchQuery = '', month = null) {
    const todayStr = getTodayIST();
    if (dateStr && dateStr !== 'all' && dateStr > todayStr) {
        return [];
    }

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

    // Always inspect local JSON data
    const local = loadFileData();
    let fileList = local.questions || [];

    const availableLocalDates = (local.dates || []).filter(d => d <= todayStr);
    if (month && month !== 'All') {
        fileList = fileList.filter(q => q.date && q.date.startsWith(month));
    } else if (dateStr && dateStr !== 'all') {
        fileList = fileList.filter(q => q.date === dateStr);
    } else if (!dateStr && availableLocalDates.length > 0) {
        fileList = fileList.filter(q => q.date === availableLocalDates[0]);
    }

    if (category && category !== 'All') {
        fileList = fileList.filter(q => q.category && q.category.toLowerCase() === category.toLowerCase());
    }

    // If local JSON has MORE questions for this date/month than MongoDB, prefer local JSON!
    if (!list || list.length < fileList.length) {
        list = fileList;
        // Asynchronously update MongoDB in background
        if (questionsCollection && dateStr && dateStr !== 'all') {
            const fullDateQuestions = (local.questions || []).filter(q => q.date === dateStr);
            if (fullDateQuestions.length > 0) {
                questionsCollection.deleteMany({ date: dateStr })
                    .then(() => questionsCollection.insertMany(fullDateQuestions))
                    .catch(() => {});
            }
        }
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

function validatePhoneNumber(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const clean = phone.replace(/\D/g, '');
    return /^[6-9]\d{9}$/.test(clean);
}

async function registerUser(phone, password) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!validatePhoneNumber(cleanPhone)) {
        return { status: 'error', message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' };
    }
    if (!password || password.length < 4) {
        return { status: 'error', message: 'Password must be at least 4 characters.' };
    }

    try {
        const uCol = await connectUsersDB();
        if (uCol) {
            const existing = await uCol.findOne({ phone: cleanPhone });
            if (existing) {
                return { status: 'error', message: 'Mobile number already registered. Please Sign In.' };
            }
            const newUser = {
                phone: cleanPhone,
                password: password,
                bookmarks: {},
                activity: {},
                createdAt: new Date().toISOString()
            };
            await uCol.insertOne(newUser);
            return {
                status: 'success',
                user: { phone: cleanPhone, bookmarks: {}, activity: {} }
            };
        }
    } catch (e) {
        console.warn('[Storage] Mongo registerUser fallback:', e.message);
    }

    const local = loadUsersData();
    const existing = (local.users || []).find(u => u.phone === cleanPhone);
    if (existing) {
        return { status: 'error', message: 'Mobile number already registered. Please Sign In.' };
    }
    const newUser = {
        phone: cleanPhone,
        password: password,
        bookmarks: {},
        activity: {},
        createdAt: new Date().toISOString()
    };
    local.users.push(newUser);
    saveUsersData();
    return {
        status: 'success',
        user: { phone: cleanPhone, bookmarks: {}, activity: {} }
    };
}

async function loginUser(phone, password) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!validatePhoneNumber(cleanPhone)) {
        return { status: 'error', message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.' };
    }
    if (!password) {
        return { status: 'error', message: 'Please enter your password.' };
    }

    try {
        const uCol = await connectUsersDB();
        if (uCol) {
            const user = await uCol.findOne({ phone: cleanPhone });
            if (!user) {
                return { status: 'error', message: 'Mobile number not registered. Please Sign Up.' };
            }
            if (user.password !== password) {
                return { status: 'error', message: 'Incorrect password. Please try again.' };
            }
            return {
                status: 'success',
                user: {
                    phone: user.phone,
                    bookmarks: user.bookmarks || {},
                    activity: user.activity || {}
                }
            };
        }
    } catch (e) {
        console.warn('[Storage] Mongo loginUser fallback:', e.message);
    }

    const local = loadUsersData();
    const user = (local.users || []).find(u => u.phone === cleanPhone);
    if (!user) {
        return { status: 'error', message: 'Mobile number not registered. Please Sign Up.' };
    }
    if (user.password !== password) {
        return { status: 'error', message: 'Incorrect password. Please try again.' };
    }
    return {
        status: 'success',
        user: {
            phone: user.phone,
            bookmarks: user.bookmarks || {},
            activity: user.activity || {}
        }
    };
}

async function saveUserActivity(phone, date, total, attempted) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!validatePhoneNumber(cleanPhone) || !date) {
        return { status: 'error', message: 'Invalid data' };
    }

    const totalQ = Number(total) || 1;
    const attemptedQ = Number(attempted) || 0;
    const dayStatus = attemptedQ >= totalQ ? 'completed' : (attemptedQ > 0 ? 'half' : 'missed');
    const activityItem = {
        total: totalQ,
        attempted: attemptedQ,
        status: dayStatus,
        updatedAt: new Date().toISOString()
    };

    try {
        const uCol = await connectUsersDB();
        if (uCol) {
            await uCol.updateOne(
                { phone: cleanPhone },
                { $set: { [`activity.${date}`]: activityItem } }
            );
            const user = await uCol.findOne({ phone: cleanPhone });
            return { status: 'success', activity: user ? user.activity : {} };
        }
    } catch (e) {
        console.warn('[Storage] Mongo saveUserActivity fallback:', e.message);
    }

    const local = loadUsersData();
    const user = (local.users || []).find(u => u.phone === cleanPhone);
    if (user) {
        if (!user.activity) user.activity = {};
        user.activity[date] = activityItem;
        saveUsersData();
        return { status: 'success', activity: user.activity };
    }
    return { status: 'error', message: 'User not found' };
}

async function syncUserBookmarks(phone, bookmarks) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!validatePhoneNumber(cleanPhone)) {
        return { status: 'error', message: 'Invalid phone' };
    }

    try {
        const uCol = await connectUsersDB();
        if (uCol) {
            await uCol.updateOne(
                { phone: cleanPhone },
                { $set: { bookmarks: bookmarks || {} } }
            );
            return { status: 'success' };
        }
    } catch (e) {
        console.warn('[Storage] Mongo syncUserBookmarks fallback:', e.message);
    }

    const local = loadUsersData();
    const user = (local.users || []).find(u => u.phone === cleanPhone);
    if (user) {
        user.bookmarks = bookmarks || {};
        saveUsersData();
        return { status: 'success' };
    }
    return { status: 'error', message: 'User not found' };
}

async function getUserProfile(phone) {
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (!validatePhoneNumber(cleanPhone)) {
        return { status: 'error', message: 'Invalid phone' };
    }

    try {
        const uCol = await connectUsersDB();
        if (uCol) {
            const user = await uCol.findOne({ phone: cleanPhone });
            if (user) {
                return {
                    status: 'success',
                    user: {
                        phone: user.phone,
                        bookmarks: user.bookmarks || {},
                        activity: user.activity || {}
                    }
                };
            }
        }
    } catch (e) {}

    const local = loadUsersData();
    const user = (local.users || []).find(u => u.phone === cleanPhone);
    if (user) {
        return {
            status: 'success',
            user: {
                phone: user.phone,
                bookmarks: user.bookmarks || {},
                activity: user.activity || {}
            }
        };
    }
    return { status: 'error', message: 'User not found' };
}

module.exports = {
    connectDB,
    saveQuestionsForDate,
    shuffleQuestions,
    getAvailableDates,
    getQuestions,
    getCategories,
    getQuestionCount,
    syncJsonToMongo,
    validatePhoneNumber,
    registerUser,
    loginUser,
    saveUserActivity,
    syncUserBookmarks,
    getUserProfile,
    getTodayIST
};
