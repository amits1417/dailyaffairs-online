const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Fetch and parse IndiaBIX current affairs for a given date string (YYYY-MM-DD)
 */
async function scrapeIndiaBixDate(dateStr) {
    const targetUrl = `https://www.indiabix.com/current-affairs/${dateStr}/`;
    console.log(`[Scraper] Fetching IndiaBIX page: ${targetUrl}`);

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

        $('.bix-div-container').each((index, el) => {
            const container = $(el);

            // Question number & text
            const qnoText = container.find('.bix-td-qno').text().trim();
            const qno = parseInt(qnoText.replace('.', '')) || (index + 1);
            const questionText = container.find('.bix-td-qtxt').text().trim();

            if (!questionText) return;

            // Options
            const options = {};
            const optionRows = container.find('.bix-opt-row');
            
            optionRows.each((optIdx, optEl) => {
                const optRow = $(optEl);
                const optLetter = String.fromCharCode(65 + optIdx); // A, B, C, D
                const optValue = optRow.find('.bix-td-option-val').text().trim();
                if (optValue) {
                    options[optLetter] = optValue;
                }
            });

            // Answer
            let answer = container.find('input.jq-hdnakq').val();
            if (!answer) {
                const ansSpan = container.find('.bix-ans-option .option-svg-letter-a, .bix-ans-option .option-svg-letter-b, .bix-ans-option .option-svg-letter-c, .bix-ans-option .option-svg-letter-d');
                if (ansSpan.length > 0) {
                    const classAttr = ansSpan.attr('class') || '';
                    const match = classAttr.match(/option-svg-letter-([a-d])/i);
                    if (match) {
                        answer = match[1].toUpperCase();
                    }
                }
            }

            // Explanation
            let explanation = container.find('.bix-ans-description').text().trim();
            // Clean up extra whitespaces
            explanation = explanation.replace(/\s+/g, ' ');

            // Category
            let category = container.find('.explain-link a').text().trim() || 'General';

            // Generate unique QID
            const id = `${dateStr}-${qno}`;

            questions.push({
                id,
                date: dateStr,
                qno,
                question: questionText,
                options,
                answer: answer || 'A',
                explanation: explanation || 'No explanation available.',
                category
            });
        });

        console.log(`[Scraper] Successfully parsed ${questions.length} questions for date ${dateStr}`);
        return questions;

    } catch (error) {
        console.error(`[Scraper] Error fetching date ${dateStr}:`, error.message);
        return [];
    }
}

/**
 * Get latest active dates from IndiaBIX Current Affairs main page
 */
async function getLatestDatesFromIndex() {
    try {
        const url = 'https://www.indiabix.com/current-affairs/questions-and-answers/';
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const dates = new Set();

        $('a[href*="/current-affairs/20"]').each((i, el) => {
            const href = $(el).attr('href');
            const match = href.match(/\/current-affairs\/(\d{4}-\d{2}-\d{2})\/?/);
            if (match) {
                dates.add(match[1]);
            }
        });

        return Array.from(dates).sort().reverse();
    } catch (e) {
        console.error('[Scraper] Failed to fetch index dates:', e.message);
        return [];
    }
}

module.exports = {
    scrapeIndiaBixDate,
    getLatestDatesFromIndex,
    formatDate
};
