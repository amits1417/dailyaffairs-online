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
 * Parse GKToday quiz URL into ALL dates it covers.
 * Handles single-date slugs AND combined-range slugs that GKToday
 * publishes on some days, e.g.:
 *   "daily-current-affairs-quiz-september-82026"    -> ["2026-09-08"]
 *   "daily-current-affairs-quiz-september-13-142026" -> ["2026-09-13", "2026-09-14"]
 *   "daily-current-affairs-quiz-september-6-72026"   -> ["2026-09-06", "2026-09-07"]
 */
function parseGktodayUrlAll(href) {
    if (!href || typeof href !== 'string') return [];

    const rangeMatch = href.match(/daily-current-affairs-quiz-([a-z]+)-(\d{1,2})-(\d{1,2})(\d{4})/);
    if (rangeMatch) {
        const [, monthName, day1, day2, year] = rangeMatch;
        const monthNum = MONTH_NAME_TO_NUM[monthName.toLowerCase()];
        if (!monthNum) return [];
        const start = parseInt(day1, 10);
        const end = parseInt(day2, 10);
        if (isNaN(start) || isNaN(end) || end < start || (end - start) > 6) return [];
        const dates = [];
        for (let d = start; d <= end; d++) {
            dates.push(`${year}-${monthNum}-${String(d).padStart(2, '0')}`);
        }
        return dates;
    }

    const single = parseGktodayUrl(href);
    return single ? [single] : [];
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
 * Parse questions out of a loaded GKToday quiz page.
 * Shared by direct-date fetch and combined-range fallback fetch.
 */
function parseGktodayQuizHtml($, dateStr) {
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

    return questions;
}

/**
 * Find a GKToday quiz URL covering the given date by scanning the index page.
 * Needed because GKToday sometimes publishes combined-range quizzes
 * (e.g. "september-13-142026") instead of a single-date page.
 * Returns the quiz page URL or null.
 */
async function findGktodayUrlForDate(dateStr) {
    try {
        const response = await axios.get('https://www.gktoday.in/gk-current-affairs-quiz-questions-answers/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const candidates = [];

        $('a[href*="/daily-current-affairs-quiz-"]').each((i, el) => {
            const href = $(el).attr('href');
            if (parseGktodayUrlAll(href).includes(dateStr)) {
                const absolute = href.startsWith('http') ? href : `https://www.gktoday.in${href.startsWith('/') ? '' : '/'}${href}`;
                if (!candidates.includes(absolute)) candidates.push(absolute);
            }
        });

        // Prefer single-date URL over a combined-range one when both exist
        candidates.sort((a, b) => {
            const aIsRange = /-\d{1,2}-\d{1,2}\d{4}/.test(a) ? 1 : 0;
            const bIsRange = /-\d{1,2}-\d{1,2}\d{4}/.test(b) ? 1 : 0;
            return aIsRange - bIsRange;
        });

        return candidates.length > 0 ? candidates[0] : null;
    } catch (e) {
        console.error(`[GKToday Scraper] Index lookup failed for ${dateStr}:`, e.message);
        return null;
    }
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
        const questions = parseGktodayQuizHtml($, dateStr);

        console.log(`[GKToday Scraper] Parsed ${questions.length} questions for ${dateStr}`);
        return questions;

    } catch (error) {
        console.error(`[GKToday Scraper] Error fetching ${dateStr}:`, error.message);

        // Fallback: GKToday may have published this date inside a
        // combined-range quiz (e.g. September 13-14). Look it up via index.
        if (error.response && error.response.status === 404) {
            console.log(`[GKToday Scraper] Trying index fallback for ${dateStr}...`);
            const fallbackUrl = await findGktodayUrlForDate(dateStr);
            if (fallbackUrl) {
                try {
                    console.log(`[GKToday Scraper] Fallback fetching: ${fallbackUrl}`);
                    const fbResponse = await axios.get(fallbackUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.5'
                        },
                        timeout: 15000
                    });
                    const $fb = cheerio.load(fbResponse.data);
                    const fbQuestions = parseGktodayQuizHtml($fb, dateStr);
                    console.log(`[GKToday Scraper] Fallback parsed ${fbQuestions.length} questions for ${dateStr}`);
                    return fbQuestions;
                } catch (fbError) {
                    console.error(`[GKToday Scraper] Fallback failed for ${dateStr}:`, fbError.message);
                }
            }
        }

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
            for (const dateStr of parseGktodayUrlAll(href)) {
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
    parseGktodayUrl,
    parseGktodayUrlAll,
    findGktodayUrlForDate
};
