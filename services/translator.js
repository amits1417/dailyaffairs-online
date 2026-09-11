const axios = require('axios');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '..', 'data', 'translation_cache.json');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

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
        console.error('Failed to save translation cache:', e.message);
    }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

/**
 * Protect English Themes, Mottos, and Quoted Statements from being translated.
 * Extracts "..." or '...' or theme/motto phrases, replaces them with tokens, translates text, and restores original English quotes.
 */
function protectThemesAndMottos(text) {
    if (!text || typeof text !== 'string') return { text: '', tokens: {} };

    const tokens = {};
    let counter = 0;

    // Pattern to capture quotes, themes, mottos, and taglines
    // e.g. "Literacy for people, the planet and prosperity", 'Viksit Bharat @2047'
    let tokenizedText = text.replace(/([“"']([^"“'”]{4,})["”']|theme\s+["“']?([^"“'”\.,]+)["”']?|motto\s+["“']?([^"“'”\.,]+)["”']?)/gi, (match, p1) => {
        const token = `__ENG_THEME_TOKEN_${counter}__`;
        tokens[token] = match; // Preserve original English theme/motto statement
        counter++;
        return token;
    });

    return { tokenizedText, tokens };
}

/**
 * Restore original English themes/mottos into translated string
 */
function restoreThemesAndMottos(translatedText, tokens) {
    let restored = translatedText;
    for (const [token, originalString] of Object.entries(tokens)) {
        restored = restored.replace(token, originalString);
    }
    return restored;
}

/**
 * Translate text to target language ('hi' or 'gu') preserving English Themes and Mottos
 */
async function translateText(text, targetLang, retries = 3) {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    if (targetLang === 'en') return text;

    const cacheKey = `${targetLang}:${text.trim()}`;
    if (translationCache[cacheKey]) {
        return translationCache[cacheKey];
    }

    // Step 1: Protect English Themes/Mottos/Quotes
    const { tokenizedText, tokens } = protectThemesAndMottos(text);

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(tokenizedText)}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            if (response.data && response.data[0]) {
                let translated = response.data[0].map(item => item[0]).filter(Boolean).join('');
                if (translated) {
                    // Step 2: Restore original English themes/mottos
                    translated = restoreThemesAndMottos(translated, tokens);

                    translationCache[cacheKey] = translated;
                    saveCache();
                    return translated;
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 429) {
                await sleep(1500 * attempt);
            } else {
                await sleep(500);
            }
        }
    }

    return text;
}

/**
 * Translate a full question item into Gujarati and Hindi
 */
async function translateQuestionItem(item) {
    const [
        hiQ, hiA, hiB, hiC, hiD, hiExp,
        guQ, guA, guB, guC, guD, guExp
    ] = await Promise.all([
        translateText(item.question, 'hi'),
        translateText(item.options.A, 'hi'),
        translateText(item.options.B, 'hi'),
        translateText(item.options.C, 'hi'),
        translateText(item.options.D, 'hi'),
        translateText(item.explanation, 'hi'),
        translateText(item.question, 'gu'),
        translateText(item.options.A, 'gu'),
        translateText(item.options.B, 'gu'),
        translateText(item.options.C, 'gu'),
        translateText(item.options.D, 'gu'),
        translateText(item.explanation, 'gu')
    ]);

    return {
        id: item.id,
        date: item.date,
        qno: item.qno,
        answer: item.answer,
        category: item.category,
        en: {
            question: item.question,
            options: { ...item.options },
            explanation: item.explanation
        },
        hi: {
            question: hiQ,
            options: { A: hiA, B: hiB, C: hiC, D: hiD },
            explanation: hiExp
        },
        gu: {
            question: guQ,
            options: { A: guA, B: guB, C: guC, D: guD },
            explanation: guExp
        }
    };
}

module.exports = {
    translateText,
    translateQuestionItem,
    protectThemesAndMottos,
    restoreThemesAndMottos
};
