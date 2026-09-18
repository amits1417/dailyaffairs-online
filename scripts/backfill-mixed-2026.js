const fs = require('fs');
const path = require('path');
const { 
    MONTH_SLUGS, 
    fetchGKTodayQuestions, 
    fetchIndiaBixDateQuestions, 
    isDuplicateQuestion, 
    normalizeCategory 
} = require('./scraper-mix-core');
const { translateText } = require('../services/translator');

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');

const sleep = ms => new Promise(res => setTimeout(res, ms));

async function translateOptionsFast(optionsObj, targetLang) {
    const letters = ['A', 'B', 'C', 'D'].filter(l => optionsObj && optionsObj[l]);
    if (letters.length === 0) return {};
    
    const joined = letters.map(l => optionsObj[l]).join(' \n###\n ');
    try {
        const translatedJoined = await translateText(joined, targetLang);
        const parts = translatedJoined.split(/\s*###\s*/);
        const result = {};
        letters.forEach((l, i) => {
            result[l] = parts[i] ? parts[i].trim() : optionsObj[l];
        });
        return result;
    } catch (e) {
        console.warn(`[Translate] Error translating options for ${targetLang}:`, e.message);
        return { ...optionsObj };
    }
}

async function translateQuestionItemFast(item) {
    try {
        const [hiQ, hiOpts, hiExp, guQ, guOpts, guExp] = await Promise.all([
            translateText(item.question, 'hi'),
            translateOptionsFast(item.options, 'hi'),
            translateText(item.explanation, 'hi'),
            translateText(item.question, 'gu'),
            translateOptionsFast(item.options, 'gu'),
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
                options: hiOpts,
                explanation: hiExp
            },
            gu: {
                question: guQ,
                options: guOpts,
                explanation: guExp
            }
        };
    } catch (e) {
        console.error(`[Translate] Error on question ${item.id}:`, e.message);
        return null;
    }
}

async function run() {
    console.log('================================================================');
    console.log('🚀 Starting Multi-Month IndiaBIX + GKToday Integration (Jan-Sep 2026)');
    console.log('================================================================');

    let dbData = { dates: [], questions: [] };
    if (fs.existsSync(DATA_FILE)) {
        dbData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }

    console.log(`Initial DB: ${dbData.questions.length} questions across ${dbData.dates.length} dates.`);

    const months = [
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09'
    ];

    let totalAdded = 0;

    for (const monthStr of months) {
        const slug = MONTH_SLUGS[monthStr];
        console.log(`\n----------------------------------------------------`);
        console.log(`📅 Processing Month: ${monthStr} (${slug})`);
        console.log(`----------------------------------------------------`);

        const rawMonthQuestions = [];

        // 1. Fetch GKToday Questions for this month (Pages 1 & 2 = ~20 questions)
        console.log(`[GKToday] Fetching questions for ${monthStr}...`);
        const gkP1 = await fetchGKTodayQuestions(monthStr, slug, 1);
        await sleep(500);
        const gkP2 = await fetchGKTodayQuestions(monthStr, slug, 2);
        await sleep(500);
        rawMonthQuestions.push(...gkP1, ...gkP2);
        console.log(`[GKToday] Retrieved ${gkP1.length + gkP2.length} questions for ${monthStr}.`);

        // 2. For months 2026-01 to 2026-06: Fetch IndiaBIX dates
        if (monthStr <= '2026-06') {
            const sampleDays = ['05', '12', '18', '25'];
            for (const day of sampleDays) {
                const dateStr = `${monthStr}-${day}`;
                const bixQuestions = await fetchIndiaBixDateQuestions(dateStr);
                rawMonthQuestions.push(...bixQuestions);
                await sleep(500);
            }
        }

        console.log(`[Collected] Total raw candidates for ${monthStr}: ${rawMonthQuestions.length}`);

        // 3. Deduplication: against existing DB questions AND within current month batch
        const uniqueMonthQuestions = [];
        let duplicateCount = 0;

        for (const item of rawMonthQuestions) {
            if (isDuplicateQuestion(item.question, dbData.questions) || 
                isDuplicateQuestion(item.question, uniqueMonthQuestions)) {
                duplicateCount++;
                continue;
            }
            uniqueMonthQuestions.push(item);
        }

        console.log(`[Deduplication] Removed ${duplicateCount} duplicates. Unique questions to translate: ${uniqueMonthQuestions.length}`);

        // 4. Translate & format unique questions
        const translatedQuestions = [];
        for (let i = 0; i < uniqueMonthQuestions.length; i++) {
            const rawItem = uniqueMonthQuestions[i];
            const qno = i + 1;
            rawItem.qno = qno;
            rawItem.id = `${rawItem.date}-${qno}`;

            process.stdout.write(`[Translating ${i + 1}/${uniqueMonthQuestions.length}] ${rawItem.date} (${rawItem.category}): ${rawItem.question.substring(0, 35)}...\r`);
            const translated = await translateQuestionItemFast(rawItem);
            if (translated) {
                translatedQuestions.push(translated);
            }
            await sleep(150);
        }
        console.log(`\n[Translated] Successfully translated ${translatedQuestions.length} questions for ${monthStr}.`);

        // 5. Append to database
        dbData.questions.push(...translatedQuestions);

        // Update dates list
        translatedQuestions.forEach(q => {
            if (!dbData.dates.includes(q.date)) {
                dbData.dates.push(q.date);
            }
        });
        dbData.dates.sort().reverse();

        totalAdded += translatedQuestions.length;

        // Save progress to disk
        fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2), 'utf8');
        console.log(`💾 Saved ${monthStr}. Current total DB questions: ${dbData.questions.length}`);
    }

    console.log('\n================================================================');
    console.log(`🎉 All months processed! Total new questions added: ${totalAdded}`);
    console.log(`📊 Final DB count: ${dbData.questions.length} questions across ${dbData.dates.length} dates.`);
    console.log('================================================================');
}

run().catch(err => {
    console.error('Fatal Integration Error:', err);
    process.exit(1);
});
