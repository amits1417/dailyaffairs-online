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

// Common English words that should be translated in Hindi/Gujarati
const COMMON_WORDS_HI = {
    'which': 'कौन सा', 'what': 'क्या', 'who': 'कौन', 'where': 'कहाँ', 'when': 'कब',
    'how': 'कैसे', 'why': 'क्यों', 'is': 'है', 'are': 'हैं', 'was': 'था', 'were': 'थे',
    'has': 'के पास है', 'have': 'के पास है', 'had': 'के पास था',
    'will': 'होगा', 'shall': 'होगा', 'can': 'सकता है', 'may': 'सकता है',
    'should': 'चाहिए', 'could': 'सकता था', 'would': 'होता', 'must': 'जरूर',
    'not': 'नहीं', 'no': 'नहीं', 'yes': 'हाँ',
    'the': '', 'a': 'एक', 'an': 'एक',
    'in': 'में', 'on': 'पर', 'at': 'पर', 'for': 'के लिए', 'with': 'के साथ',
    'from': 'से', 'to': 'को', 'by': 'द्वारा', 'of': 'का',
    'and': 'और', 'or': 'या', 'but': 'लेकिन',
    'this': 'यह', 'that': 'वह', 'these': 'ये', 'those': 'वे',
    'new': 'नया', 'old': 'पुराना', 'first': 'पहला', 'last': 'आखिरी',
    'country': 'देश', 'state': 'राज्य', 'city': 'शहर',
    'government': 'सरकार', 'minister': 'मंत्री', 'president': 'राष्ट्रपति',
    'prime': 'प्रधान', 'chief': 'मुख्य',
    'organisation': 'संगठन', 'organization': 'संगठन', 'company': 'कंपनी',
    'bank': 'बैंक', 'court': 'अदालत', 'army': 'सेना', 'navy': 'नौसेना',
    ' awarded': 'को पुरस्कार दिया', 'won': 'जीता', 'launched': 'शुरू किया',
    'developed': 'विकसित किया', 'signed': 'हस्ताक्षर किए',
    'important': 'महत्वपूर्ण', 'annual': 'वार्षिक', 'international': 'अंतर्राष्ट्रीय',
    'national': 'राष्ट्रीय', 'global': 'वैश्विक',
    'report': 'रिपोर्ट', 'index': 'सूचकांक', 'summit': 'शिखर सम्मेलन',
    'month': 'महीना', 'year': 'साल', 'day': 'दिन',
    'website': 'वेबसाइट', 'app': 'ऐप', 'application': 'ऐपlication',
    'project': 'परियोजना', 'scheme': 'योजना', 'program': 'कार्यक्रम',
    'digital': 'डिजिटल', 'online': 'ऑनलाइन',
    'under': 'के तहत', 'during': 'के दौरान', 'after': 'के बाद', 'before': 'से पहले',
    'between': 'के बीच', 'through': 'के माध्यम से',
    'also': 'भी', 'more': 'अधिक', 'most': 'सबसे',
    'held': 'आयोजित', 'host': 'मेजबान', 'hosted': 'मेजबान',
};

const COMMON_WORDS_GU = {
    'which': 'કયું', 'what': 'શું', 'who': 'કોણ', 'where': 'ક્યાં', 'when': 'ક્યારે',
    'how': 'કેવી રીતે', 'why': 'શા માટે', 'is': 'છે', 'are': 'છે', 'was': 'હતું', 'were': 'હતા',
    'has': 'છે', 'have': 'છે', 'had': 'હતું',
    'will': 'થશે', 'shall': 'થશે', 'can': 'શકે છે', 'may': 'શકે છે',
    'should': 'જોઈએ', 'could': 'શકે હતું', 'would': 'થાત', 'must': 'જરૂર',
    'not': 'નહીં', 'no': 'નહીં', 'yes': 'હા',
    'the': '', 'a': 'એક', 'an': 'એક',
    'in': 'માં', 'on': 'પર', 'at': 'પર', 'for': 'માટે', 'with': 'સાથે',
    'from': 'થી', 'to': 'ને', 'by': 'દ્વારા', 'of': 'નું',
    'and': 'અને', 'or': 'અથવા', 'but': 'પરંતુ',
    'this': 'આ', 'that': 'તે', 'these': 'આ', 'those': 'તે',
    'new': 'નવું', 'old': 'જૂનું', 'first': 'પ્રથમ', 'last': 'છેલ્લું',
    'country': 'દેશ', 'state': 'રાજ્ય', 'city': 'શહેર',
    'government': 'સરકાર', 'minister': 'મંત્રી', 'president': 'રાષ્ટ્રપતિ',
    'prime': 'પ્રધાન', 'chief': 'મુખ્ય',
    'organisation': 'સંગઠન', 'organization': 'સંગઠન', 'company': 'કંપની',
    'bank': 'બેંક', 'court': 'અદાલત', 'army': 'સેના', 'navy': 'નૌકાદળ',
    ' awarded': 'ને પુરસ્કાર આપવામાં આવ્યો', 'won': 'જીત્યો', 'launched': 'શરૂ કર્યો',
    'developed': 'વિકસાવ્યું', 'signed': 'સહી કરી',
    'important': 'મહત્વપૂર્ણ', 'annual': 'વાર્ષિક', 'international': 'આંતરરાષ્ટ્રીય',
    'national': 'રાષ્ટ્રીય', 'global': 'વૈશ્વિક',
    'report': 'અહેવાલ', 'index': 'સૂચકાંક', 'summit': 'શિખર સંમેલન',
    'month': 'મહિનો', 'year': 'વર્ષ', 'day': 'દિવસ',
    'website': 'વેબસાઇટ', 'app': 'એપ', 'application': 'એપ્લિકેશન',
    'project': 'પરિયોજના', 'scheme': 'યોજના', 'program': 'કાર્યક્રમ',
    'digital': 'ડિજિટલ', 'online': 'ઓનલાઇન',
    'under': 'હેઠળ', 'during': 'દરમિયાન', 'after': 'પછી', 'before': 'પહેલાં',
    'between': 'વચ્ચે', 'through': 'દ્વારા',
    'also': 'પણ', 'more': 'વધુ', 'most': 'સૌથી',
    'held': 'યોજાયો', 'host': 'યજમાન', 'hosted': 'યજમાની',
};

function protectThemesAndMottos(text) {
    if (!text || typeof text !== 'string') return { text: '', tokens: {} };

    const tokens = {};
    let counter = 0;

    let tokenizedText = text.replace(/([""']([^""'"]{4,})[""']|theme\s+[""']?([^""'"\.,]+)[""']?|motto\s+[""']?([^""'"\.,]+)[""']?)/gi, (match, p1) => {
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

function containsEnglish(text) {
    if (!text) return false;
    return /[a-zA-Z]{3,}/.test(text);
}

function postProcessTranslation(text, targetLang) {
    if (!text) return text;

    const words = COMMON_WORDS_HI;
    const wordsGu = COMMON_WORDS_GU;
    const dict = targetLang === 'hi' ? words : wordsGu;

    let result = text;
    for (const [eng, native] of Object.entries(dict)) {
        const regex = new RegExp('\\b' + eng + '\\b', 'gi');
        result = result.replace(regex, native);
    }

    return result;
}

async function translateText(text, targetLang, retries = 3) {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    if (targetLang === 'en') return text;

    const cacheKey = `${targetLang}:${text.trim()}`;
    if (translationCache[cacheKey]) {
        return translationCache[cacheKey];
    }

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
                    translated = restoreThemesAndMottos(translated, tokens);

                    // Post-process to replace remaining English words
                    if (containsEnglish(translated) && targetLang !== 'en') {
                        translated = postProcessTranslation(translated, targetLang);
                    }

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
