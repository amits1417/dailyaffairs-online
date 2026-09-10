const fs = require('fs');
const path = require('path');
const { translateText } = require('../services/translator');

const DATA_FILE = path.join(__dirname, '..', 'data', 'current_affairs.json');

const sleep = ms => new Promise(res => setTimeout(res, ms));

// Helper: Check if text is still untranslated English (contains English words)
function isUntranslatedEnglish(text) {
    if (!text || typeof text !== 'string') return true;
    // Check if contains English alphabets words longer than 3 letters
    const match = text.match(/[a-zA-Z]{4,}/g);
    return match && match.length > 0;
}

async function retranslateAll() {
    console.log('===========================================================');
    console.log('🧹 Starting Complete Translation Audit & Cleanup');
    console.log('===========================================================');

    if (!fs.existsSync(DATA_FILE)) {
        console.error('Data file not found!');
        return;
    }

    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    console.log(`Auditing ${db.questions.length} total questions...`);

    let fixedGuCount = 0;
    let fixedHiCount = 0;

    for (let i = 0; i < db.questions.length; i++) {
        const q = db.questions[i];
        let modified = false;

        // Verify English original text exists
        const origQuestion = q.en ? q.en.question : q.question;
        const origOptions = q.en ? q.en.options : q.options;
        const origExplanation = q.en ? q.en.explanation : q.explanation;

        // Standardize EN object
        q.en = {
            question: origQuestion,
            options: { ...origOptions },
            explanation: origExplanation
        };

        // Check & Fix GUJARATI (gu)
        if (!q.gu || isUntranslatedEnglish(q.gu.question) || isUntranslatedEnglish(q.gu.explanation)) {
            console.log(`[${i + 1}/${db.questions.length}] Translating to GUJARATI for QID: ${q.id}...`);
            
            const guQuestion = await translateText(origQuestion, 'gu');
            const guOptA = await translateText(origOptions.A, 'gu');
            const guOptB = await translateText(origOptions.B, 'gu');
            const guOptC = await translateText(origOptions.C, 'gu');
            const guOptD = await translateText(origOptions.D, 'gu');
            const guExplanation = await translateText(origExplanation, 'gu');

            q.gu = {
                question: guQuestion,
                options: { A: guOptA, B: guOptB, C: guOptC, D: guOptD },
                explanation: guExplanation
            };
            fixedGuCount++;
            modified = true;
            await sleep(400); // Gentle delay between translation calls
        }

        // Check & Fix HINDI (hi)
        if (!q.hi || isUntranslatedEnglish(q.hi.question) || isUntranslatedEnglish(q.hi.explanation)) {
            console.log(`[${i + 1}/${db.questions.length}] Translating to HINDI for QID: ${q.id}...`);
            
            const hiQuestion = await translateText(origQuestion, 'hi');
            const hiOptA = await translateText(origOptions.A, 'hi');
            const hiOptB = await translateText(origOptions.B, 'hi');
            const hiOptC = await translateText(origOptions.C, 'hi');
            const hiOptD = await translateText(origOptions.D, 'hi');
            const hiExplanation = await translateText(origExplanation, 'hi');

            q.hi = {
                question: hiQuestion,
                options: { A: hiOptA, B: hiOptB, C: hiOptC, D: hiOptD },
                explanation: hiExplanation
            };
            fixedHiCount++;
            modified = true;
            await sleep(400);
        }

        // Save progress every 10 items
        if (modified && (i % 10 === 0 || i === db.questions.length - 1)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
            console.log(`[Progress Saved] Audited ${i + 1}/${db.questions.length} questions.`);
        }
    }

    fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');

    console.log('===========================================================');
    console.log(`🎉 Audit Complete! Fixed GU: ${fixedGuCount}, Fixed HI: ${fixedHiCount}`);
    console.log('===========================================================');
    process.exit(0);
}

retranslateAll().catch(err => {
    console.error('Audit Error:', err);
    process.exit(1);
});
