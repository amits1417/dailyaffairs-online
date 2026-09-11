const axios = require('axios');
const cheerio = require('cheerio');

const MONTH_NAME_TO_NUM = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
};

/**
 * Parse GKToday date from quiz URL
 * URL format: /daily-current-affairs-quiz-{month}-{day}{year}/
 * e.g. "daily-current-affairs-quiz-september-82026" -> "2026-09-08"
 */
function parseGktodayUrl(href) {
    const match = href.match(/daily-current-affairs-quiz-([a-z]+)-(\d{1,2})(\d{4})/);
    if (!match) return null;
    const [, monthName, day, year] = match;
    const monthNum = MONTH_NAME_TO_NUM[monthName];
    if (!monthNum) return null;
    const dayPadded = day.padStart(2, '0');
    return `${year}-${monthNum}-${dayPadded}`;
}

/**
 * Build GKToday URL slug from YYYY-MM-DD date string
 * e.g. "2026-09-08" -> "82026" (day + year, no leading zeros, no month)
 * GKToday URL format: /daily-current-affairs-quiz-{month}-{day}{year}/
 */
function buildSlugFromDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const dayNoZero = parseInt(day).toString();
    return `${dayNoZero}${year}`;
}

/**
 * Convert month number (01-12) to lowercase name
 */
function monthNumToName(num) {
    const names = {
        '01': 'january', '02': 'february', '03': 'march', '04': 'april',
        '05': 'may', '06': 'june', '07': 'july', '08': 'august',
        '09': 'september', '10': 'october', '11': 'november', '12': 'december'
    };
    return names[num];
}

/**
 * Parse options from raw text block
 * Input format: "[A] text[B] text[C] text[D] text"
 * Returns: {A: 'text', B: 'text', C: 'text', D: 'text'}
 */
function parseOptions(rawText) {
    const options = {};
    const parts = rawText.split(/\[[A-D]\]/);
    const letters = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < letters.length; i++) {
        if (parts[i + 1] !== undefined) {
            options[letters[i]] = parts[i + 1].trim();
        }
    }

    return options;
}

/**
 * Extract correct answer letter from answer text
 * Input format: "Correct Answer: B [answer text]"
 * Returns: "B"
 */
function extractAnswerLetter(answerText) {
    const match = answerText.match(/Correct Answer:\s*([A-D])/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Scrape GKToday daily current affairs quiz for a given date (YYYY-MM-DD)
 */
async function scrapeGktodayDate(dateStr) {
    const monthNum = dateStr.split('-')[1];
    const monthName = monthNumToName(monthNum);
    const slug = buildSlugFromDate(dateStr);
    const targetUrl = `https://www.gktoday.in/daily-current-affairs-quiz-${monthName}-${slug}/`;
    console.log(`[GKToday Scraper] Fetching: ${targetUrl}`);

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 15000
        });

        const $ = cheerio.load(response.data);
        const questions = [];

        $('.wp_quiz_question').each((index, el) => {
            const container = $(el);

            // Question number
            const qnoText = container.find('span.quesno').text().trim();
            const qno = parseInt(qnoText.replace('.', '')) || (index + 1);

            // Question text
            const questionText = container.clone().children().remove().end().text()
                .replace(/\[[A-D]\]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Options from next sibling div
            const optionsRaw = container.next('.wp_quiz_question_options').text();
            const options = parseOptions(optionsRaw);

            // Find the answer container (wp_basic_quiz_answer div)
            const answerContainer = container.nextAll('.wp_basic_quiz_answer').first();

            // Answer
            const answerRaw = answerContainer.find('.ques_answer').first().text().trim();
            const answer = extractAnswerLetter(answerRaw) || 'A';

            // Explanation from answer_hint
            const explanation = answerContainer.find('.answer_hint').first().text().trim()
                .replace(/\s+/g, ' ');

            if (!questionText) return;

            const id = `gktoday-${dateStr}-${qno}`;

            questions.push({
                id,
                date: dateStr,
                qno,
                question: questionText,
                options,
                answer,
                explanation: explanation || 'No explanation available.',
                category: 'General'
            });
        });

        console.log(`[GKToday Scraper] Parsed ${questions.length} questions for ${dateStr}`);
        return questions;

    } catch (error) {
        console.error(`[GKToday Scraper] Error fetching ${dateStr}:`, error.message);
        return [];
    }
}

/**
 * Scrape the GKToday quiz index page to find available dates
 */
async function getLatestDatesFromGktodayIndex() {
    try {
        const url = 'https://www.gktoday.in/gk-current-affairs-quiz-questions-answers/';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const dates = new Set();

        $('a[href*="/daily-current-affairs-quiz-"]').each((i, el) => {
            const href = $(el).attr('href');
            const dateStr = parseGktodayUrl(href);
            if (dateStr) {
                dates.add(dateStr);
            }
        });

        return Array.from(dates).sort().reverse();
    } catch (e) {
        console.error('[GKToday Scraper] Failed to fetch index dates:', e.message);
        return [];
    }
}

module.exports = {
    scrapeGktodayDate,
    getLatestDatesFromGktodayIndex,
    buildSlugFromDate,
    parseGktodayUrl
};
