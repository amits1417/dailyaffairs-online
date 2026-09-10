const fs = require('fs');
const path = require('path');
const axios = require('axios');

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');
const CACHE_FILE = path.join(__dirname, '..', 'data', 'translation_cache.json');

const sleep = ms => new Promise(res => setTimeout(res, ms));

let translationCache = {};
if (fs.existsSync(CACHE_FILE)) {
    try { translationCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {}
}

function saveCache() {
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(translationCache, null, 2), 'utf8'); } catch (e) {}
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

async function translateSingleText(text, targetLang) {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    if (targetLang === 'en') return text;

    const cacheKey = `${targetLang}:${text.trim()}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    const { tokenizedText, tokens } = protectThemesAndMottos(text);

    // Strategy 1: Google Translate API
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(tokenizedText)}`;
            const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000 });
            if (response.data && response.data[0]) {
                let res = response.data[0].map(i => i[0]).filter(Boolean).join('');
                if (res && (targetLang === 'gu' ? /[\u0A80-\u0AFF]/.test(res) : /[\u0900-\u097F]/.test(res))) {
                    res = restoreThemesAndMottos(res, tokens);
                    translationCache[cacheKey] = res;
                    return res;
                }
            }
        } catch (e) {
            await sleep(800 * attempt);
        }
    }

    // Strategy 2: MyMemory API Fallback
    try {
        const langPair = targetLang === 'gu' ? 'en|gu' : 'en|hi';
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(tokenizedText)}&langpair=${langPair}`;
        const response = await axios.get(url, { timeout: 8000 });
        if (response.data && response.data.responseData && response.data.responseData.translatedText) {
            let res = response.data.responseData.translatedText;
            if (targetLang === 'gu' ? /[\u0A80-\u0AFF]/.test(res) : /[\u0900-\u097F]/.test(res)) {
                res = restoreThemesAndMottos(res, tokens);
                translationCache[cacheKey] = res;
                return res;
            }
        }
    } catch (e) {}

    return text;
}

async function translateItem(q) {
    const enQ = q.en ? q.en.question : q.question;
    const enOpts = q.en ? q.en.options : q.options;
    const enExp = q.en ? q.en.explanation : q.explanation;

    const needsGu = !q.gu || !q.gu.question || !/[\u0A80-\u0AFF]/.test(q.gu.question);
    const needsHi = !q.hi || !q.hi.question || !/[\u0900-\u097F]/.test(q.hi.question);

    if (needsGu) {
        const guQuestion = await translateSingleText(enQ, 'gu');
        const guA = await translateSingleText(enOpts.A, 'gu');
        const guB = await translateSingleText(enOpts.B, 'gu');
        const guC = await translateSingleText(enOpts.C, 'gu');
        const guD = await translateSingleText(enOpts.D, 'gu');
        const guExp = await translateSingleText(enExp, 'gu');

        q.gu = {
            question: guQuestion,
            options: { A: guA, B: guB, C: guC, D: guD },
            explanation: guExp
        };
    }

    if (needsHi) {
        const hiQuestion = await translateSingleText(enQ, 'hi');
        const hiA = await translateSingleText(enOpts.A, 'hi');
        const hiB = await translateSingleText(enOpts.B, 'hi');
        const hiC = await translateSingleText(enOpts.C, 'hi');
        const hiD = await translateSingleText(enOpts.D, 'hi');
        const hiExp = await translateSingleText(enExp, 'hi');

        q.hi = {
            question: hiQuestion,
            options: { A: hiA, B: hiB, C: hiC, D: hiD },
            explanation: hiExp
        };
    }

    return needsGu || needsHi;
}

async function main() {
    console.log('🚀 Running final translation cleanup pass...');
    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    let fixed = 0;

    for (let i = 0; i < db.questions.length; i++) {
        const q = db.questions[i];
        const wasFixed = await translateItem(q);
        if (wasFixed) {
            fixed++;
            saveCache();
            fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
            console.log(`[Fixed ${fixed}] QID: ${q.id} (Date: ${q.date})`);
            await sleep(500); // Reliable pause to avoid rate limit
        }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
    console.log(`🎉 ALL TRANSLATIONS COMPLETE! Fixed in this pass: ${fixed}`);
}

main().catch(err => console.error('Final cleanup error:', err));
