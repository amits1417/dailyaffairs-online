const cronService = require('../services/cron');
const storage = require('../services/storage');

async function run() {
    console.log('--- Initializing IndiaBIX Scraper & Multilingual Translator ---');
    console.log('Fetching & translating August 2, 2026 current affairs (2026-08-02)...');
    
    await cronService.syncDate('2026-08-02');
    
    console.log('Fetching today\'s current affairs...');
    const todayStr = cronService.formatDate ? cronService.formatDate(new Date()) : '2026-09-10';
    if (todayStr !== '2026-08-02') {
        await cronService.syncDate(todayStr);
    }

    const availableDates = storage.getAvailableDates();
    console.log('Available Dates in DB:', availableDates);
    
    const guQuestions = storage.getQuestions('2026-08-02', 'gu');
    console.log(`\nSample Gujarati Question for 2026-08-02:`);
    if (guQuestions.length > 0) {
        console.log(`Q1: ${guQuestions[0].question}`);
        console.log(`Options:`, guQuestions[0].options);
        console.log(`Ans: ${guQuestions[0].answer}`);
        console.log(`Explanation: ${guQuestions[0].explanation}`);
    }
    
    console.log('\n--- Seeding Complete! ---');
    process.exit(0);
}

run().catch(err => {
    console.error('Seed Error:', err);
    process.exit(1);
});
