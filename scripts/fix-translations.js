const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'translation_cache.json');

const sleep = ms => new Promise(res => setTimeout(res, ms));

let translationCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try {
        translationCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch (e) {
        translationCache = {};
    }
}

function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(translationCache, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save cache:', e.message);
    }
}

function protectThemesAndMottos(text) {
    if (!text || typeof text !== 'string') return { tokenizedText: '', tokens: {} };
    const tokens = {};
    let counter = 0;
    let tokenizedText = text.replace(/([“"']([^"“'”]{4,})["”']|theme\s+["“']?([^"“'”\.,]+)["”']?|motto\s+["“']?([^"“'”\.,]+)["”']?)/gi, (match) => {
        const token = `__ENG_THEME_TOKEN_${counter}__`;
        tokens[token] = match;
        counter++;
        return token;
    });
    return { tokenizedText, tokens };
}

function restoreThemesAndMottos(translatedText, tokens) {
    let restored = translatedText;
    for (const [token, originalString] of Object.entries(tokens)) {
        restored = restored.replace(token, originalString);
    }
    return restored;
}

// Robust translation with Google Translate primary & MyMemory secondary fallback
async function translateTextRobust(text, targetLang) {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    if (targetLang === 'en') return text;

    const cacheKey = `${targetLang}:${text.trim()}`;
    if (translationCache[cacheKey]) {
        return translationCache[cacheKey];
    }

    const { tokenizedText, tokens } = protectThemesAndMottos(text);

    // Try Google Translate up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(tokenizedText)}`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 8000
            });

            if (response.data && response.data[0]) {
                let translated = response.data[0].map(item => item[0]).filter(Boolean).join('');
                if (translated && (targetLang === 'gu' ? /[\u0A80-\u0AFF]/.test(translated) : /[\u0900-\u097F]/.test(translated))) {
                    translated = restoreThemesAndMottos(translated, tokens);
                    translationCache[cacheKey] = translated;
                    saveCache();
                    return translated;
                }
            }
        } catch (err) {
            await sleep(1000 * attempt);
        }
    }

    // Secondary Fallback: MyMemory API
    try {
        const langPair = targetLang === 'gu' ? 'en|gu' : 'en|hi';
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(tokenizedText)}&langpair=${langPair}`;
        const response = await axios.get(url, { timeout: 8000 });
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            let translated = response.data.responseData.translatedText;
            translated = restoreThemesAndMottos(translated, tokens);
            translationCache[cacheKey] = translated;
            saveCache();
            return translated;
        }
    } catch (err) {
        console.error(`[Fallback Failed for ${targetLang}]`, err.message);
    }

    return text;
}

async function fixAllUntranslated() {
    console.log('===========================================================');
    console.log('🔍 Auditing & Translating All Untranslated Questions');
    console.log('===========================================================');

    if (!fs.existsSync(DATA_FILE)) {
        console.error('Data file current_affairs.json not found!');
        return;
    }

    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`Total questions in database: ${db.questions.length}`);

    let fixedGu = 0;
    let fixedHi = 0;

    for (let i = 0; i < db.questions.length; i++) {
        const q = db.questions[i];
        let modified = false;

        const enQ = q.en ? q.en.question : q.question;
        const enOpts = q.en ? q.en.options : q.options;
        const enExp = q.en ? q.en.explanation : q.explanation;

        // Check if Gujarati question is missing or untranslated (lacks Gujarati script)
        const isGuMissing = !q.gu || !q.gu.question || !/[\u0A80-\u0AFF]/.test(q.gu.question);
        if (isGuMissing) {
            console.log(`[${i + 1}/${db.questions.length}] Translating GUJARATI for QID: ${q.id} (Date: ${q.date})...`);
            
            const guQuestion = await translateTextRobust(enQ, 'gu');
            const guOptA = await translateTextRobust(enOpts.A, 'gu');
            const guOptB = await translateTextRobust(enOpts.B, 'gu');
            const guOptC = await translateTextRobust(enOpts.C, 'gu');
            const guOptD = await translateTextRobust(enOpts.D, 'gu');
            const guExplanation = await translateTextRobust(enExp, 'gu');

            q.gu = {
                question: guQuestion,
                options: { A: guOptA, B: guOptB, C: guOptC, D: guOptD },
                explanation: guExplanation
            };
            fixedGu++;
            modified = true;
            await sleep(300);
        }

        // Check if Hindi question is missing or untranslated (lacks Hindi script)
        const isHiMissing = !q.hi || !q.hi.question || !/[\u0900-\u097F]/.test(q.hi.question);
        if (isHiMissing) {
            console.log(`[${i + 1}/${db.questions.length}] Translating HINDI for QID: ${q.id} (Date: ${q.date})...`);

            const hiQuestion = await translateTextRobust(enQ, 'hi');
            const hiOptA = await translateTextRobust(enOpts.A, 'hi');
            const hiOptB = await translateTextRobust(enOpts.B, 'hi');
            const hiOptC = await translateTextRobust(enOpts.C, 'hi');
            const hiOptD = await translateTextRobust(enOpts.D, 'hi');
            const hiExplanation = await translateTextRobust(enExp, 'hi');

            q.hi = {
                question: hiQuestion,
                options: { A: hiOptA, B: hiOptB, C: hiOptC, D: hiOptD },
                explanation: hiExplanation
            };
            fixedHi++;
            modified = true;
            await sleep(300);
        }

        if (modified && (i % 5 === 0 || i === db.questions.length - 1)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
            console.log(`[Saved Progress] Audited ${i + 1}/${db.questions.length}`);
        }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
    console.log('===========================================================');
    console.log(`🎉 COMPLETED! Fixed Gujarati: ${fixedGu}, Fixed Hindi: ${fixedHi}`);
    console.log('===========================================================');
}

fixAllUntranslated().catch(err => {
    console.error('Error fixing translations:', err);
});
