const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const { translateQuestionItem } = require('../services/translator');
const storage = require('../services/storage');

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');

const MONTH_SLUGS = {
    '2026-01': 'january',
    '2026-02': 'february',
    '2026-03': 'march',
    '2026-04': 'april',
    '2026-05': 'may',
    '2026-06': 'june',
    '2026-07': 'july',
    '2026-08': 'august',
    '2026-09': 'september'
};

const STANDARD_CATEGORIES = [
    'National',
    'International',
    'Banking',
    'Economy',
    'Sports',
    'Defence',
    'Science & Technology',
    'Awards and Honours',
    'Environment',
    'State',
    'Places',
    'Important Days'
];

function normalizeCategory(cat, questionText = '', explanation = '') {
    if (cat && STANDARD_CATEGORIES.includes(cat)) return cat;

    const text = `${cat || ''} ${questionText} ${explanation}`.toLowerCase();
    if (/\b(cricket|football|tennis|badminton|olympic|fide|chess|fifa|medal|trophy|championship|tournament|athlete|sports|world cup|ipl)\b/i.test(text)) {
        return 'Sports';
    }
    if (/\b(army|navy|air force|missile|drdo|defence|defense|warship|military|submarine|frigate|combat|exercise|weapon)\b/i.test(text)) {
        return 'Defence';
    }
    if (/\b(rbi|bank|banking|repo rate|npa|sebi|monetary policy|imf|world bank)\b/i.test(text)) {
        return 'Banking';
    }
    if (/\b(gdp|inflation|economy|economic|fiscal|revenue|export|import|trade|budget|sensex|tax|gst)\b/i.test(text)) {
        return 'Economy';
    }
    if (/\b(isro|nasa|satellite|space|orbit|rocket|moon|mars|ai|artificial intelligence|supercomputer|quantum|chip|tech|telescope)\b/i.test(text)) {
        return 'Science & Technology';
    }
    if (/\b(wildlife|tiger|sanctuary|national park|forest|biodiversity|climate|pollution|species|wetland|ramsar|flora|fauna)\b/i.test(text)) {
        return 'Environment';
    }
    if (/\b(award|prize|honour|honor|padma|bharat ratna|nobel|oscar|dadasaheb|conferred)\b/i.test(text)) {
        return 'Awards and Honours';
    }
    if (/\b(day is observed|celebrated on|observed on|theme of.*day|international day|world.*day)\b/i.test(text)) {
        return 'Important Days';
    }
    if (/\b(united nations|un|who|unesco|g20|brics|asean|nato|eu|summit|bilateral|treaty|foreign)\b/i.test(text)) {
        return 'International';
    }
    if (/\b(chief minister|governor|government of [a-z]+|state government|guwahati|mumbai|patna|lucknow|bengaluru|chennai|hyderabad|bhopal|ahmedabad|kashmir|odisha|rajasthan|kerala|punjab|haryana|bihar|up|mp|maharashtra|gujarat|tamil nadu|karnataka|andhra|telangana)\b/i.test(text)) {
        return 'State';
    }
    return 'National';
}

function cleanText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
}

function extractKeywords(text) {
    return (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !['which', 'what', 'where', 'when', 'with', 'from', 'have', 'been', 'were', 'this', 'that', 'these', 'those', 'first', 'recently', 'news', 'india', 'state', 'government'].includes(w));
}

function isDuplicateQuestion(newQText, existingQuestionsList) {
    const cleanNew = cleanText(newQText).toLowerCase();
    const newWords = new Set(extractKeywords(newQText));
    if (newWords.size === 0) return false;

    for (const item of existingQuestionsList) {
        const existQText = item.en?.question || item.question || '';
        const cleanExist = cleanText(existQText).toLowerCase();
        
        // Exact or substring match
        if (cleanNew === cleanExist || cleanNew.includes(cleanExist) || cleanExist.includes(cleanNew)) {
            return true;
        }

        // Jaccard word similarity
        const existWords = new Set(extractKeywords(existQText));
        if (existWords.size === 0) continue;

        let common = 0;
        for (const w of newWords) {
            if (existWords.has(w)) common++;
        }
        const total = new Set([...newWords, ...existWords]).size;
        if (total > 0 && (common / total) >= 0.65) {
            return true;
        }
    }
    return false;
}

/**
 * Fetch GKToday questions for a given month slug and page
 */
async function fetchGKTodayQuestions(monthStr, slug, page = 1) {
    const url = page === 1
        ? `https://www.gktoday.in/quizbase/current-affairs-quiz-${slug}-2026`
        : `https://www.gktoday.in/quizbase/current-affairs-quiz-${slug}-2026/page/${page}`;

    console.log(`[GKToday] Scraping ${url}...`);
    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 15000
        });

        const $ = cheerio.load(res.data);
        const questions = [];

        $('.sques_quiz').each((idx, el) => {
            let qText = $(el).find('.wp_quiz_question').text().trim();
            qText = qText.replace(/^\d+\.\s*/, '').trim();
            if (!qText || qText.length < 15) return;

            const optContainer = $(el).find('.wp_quiz_question_options');
            const optHtml = optContainer.html() || '';
            const optText = optHtml.replace(/<br\s*[\/]?>/gi, '\n').replace(/<[^>]+>/g, ' ');

            const options = {};
            const matches = optText.matchAll(/\[([A-D])\]\s*([^\[\n]+)/g);
            for (const m of matches) {
                options[m[1]] = cleanText(m[2]);
            }

            // Need at least 2 options
            if (Object.keys(options).length < 2) return;

            const ansContainer = $(el).find('.ques_answer, .answer_hint');
            const ansRaw = ansContainer.text().trim();
            
            let answer = 'A';
            const ansMatch = ansRaw.match(/Correct\s*Answer:\s*([A-D])/i);
            if (ansMatch) {
                answer = ansMatch[1].toUpperCase();
            }

            let explanation = '';
            const notesMatch = ansRaw.match(/Notes:\s*(.*)/is);
            if (notesMatch) {
                explanation = cleanText(notesMatch[1]);
            } else {
                explanation = cleanText(ansRaw.replace(/Correct\s*Answer:[^\]]+\]/i, ''));
            }

            // Synthesize date within month (distribute questions across days 01-28)
            const dayNum = String(Math.min(28, (idx * 2) + 1 + ((page - 1) * 6))).padStart(2, '0');
            const dateStr = `${monthStr}-${dayNum}`;

            const category = normalizeCategory('', qText, explanation);

            questions.push({
                source: 'GKToday',
                date: dateStr,
                qno: idx + 1,
                question: qText,
                options,
                answer,
                explanation: explanation || 'Detailed examination notes for this question.',
                category
            });
        });

        return questions;
    } catch (e) {
        console.warn(`[GKToday] Error fetching page ${page} for ${monthStr}:`, e.message);
        return [];
    }
}

/**
 * Fetch IndiaBIX questions for a specific date
 */
async function fetchIndiaBixDateQuestions(dateStr) {
    const url = `https://www.indiabix.com/current-affairs/${dateStr}/`;
    console.log(`[IndiaBIX] Scraping ${url}...`);

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const questions = [];

        $('.bix-div-container').each((index, el) => {
            const container = $(el);
            const questionText = cleanText(container.find('.bix-td-qtxt').text());
            if (!questionText) return;

            const options = {};
            container.find('.bix-opt-row').each((optIdx, optEl) => {
                const optLetter = String.fromCharCode(65 + optIdx);
                const optValue = cleanText($(optEl).find('.bix-td-option-val').text());
                if (optValue) options[optLetter] = optValue;
            });

            if (Object.keys(options).length < 2) return;

            let answer = container.find('input.jq-hdnakq').val();
            if (!answer) {
                const ansSpan = container.find('.bix-ans-option [class*="option-svg-letter-"]');
                if (ansSpan.length > 0) {
                    const match = (ansSpan.attr('class') || '').match(/option-svg-letter-([a-d])/i);
                    if (match) answer = match[1].toUpperCase();
                }
            }

            const explanation = cleanText(container.find('.bix-ans-description').text());
            let category = cleanText(container.find('.explain-link a').text()) || 'General';
            category = normalizeCategory(category, questionText, explanation);

            questions.push({
                source: 'IndiaBIX',
                date: dateStr,
                qno: index + 1,
                question: questionText,
                options,
                answer: answer || 'A',
                explanation: explanation || 'Detailed examination notes for this question.',
                category
            });
        });

        return questions;
    } catch (e) {
        console.warn(`[IndiaBIX] Error fetching ${dateStr}:`, e.message);
        return [];
    }
}

module.exports = {
    MONTH_SLUGS,
    fetchGKTodayQuestions,
    fetchIndiaBixDateQuestions,
    isDuplicateQuestion,
    normalizeCategory
};
