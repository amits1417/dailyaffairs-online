const cronService = require('../services/cron');
const storage = require('../services/storage');

/**
 * Backfill Current Affairs from August 1, 2026 to today's date
 */
async function backfillAugustToToday() {
    console.log('===========================================================');
    console.log('🚀 Starting August 1 to Today Backfill Scraper & Translator');
    console.log('===========================================================');

    const startDate = new Date('2026-08-01');
    const endDate = new Date(); // Today: 2026-09-10

    const dateList = [];
    let current = new Date(endDate);

    while (current >= startDate) {
        dateList.push(cronService.formatDate(current));
        current.setDate(current.getDate() - 1);
    }

    console.log(`Generated ${dateList.length} dates from August 1 to Today.`);

    const existingDates = new Set(storage.getAvailableDates());
    let syncedCount = 0;

    for (let i = 0; i < dateList.length; i++) {
        const dateStr = dateList[i];
        
        if (existingDates.has(dateStr)) {
            console.log(`[${i + 1}/${dateList.length}] Date ${dateStr} already in DB. Skipping.`);
            continue;
        }

        console.log(`[${i + 1}/${dateList.length}] Scraping & Translating ${dateStr}...`);
        try {
            const count = await cronService.syncDate(dateStr);
            if (count > 0) {
                syncedCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
            console.error(`Error syncing ${dateStr}:`, e.message);
        }
    }

    console.log('===========================================================');
    console.log(`🎉 August to Today Backfill Completed! Dates added: ${syncedCount}`);
    console.log('===========================================================');
    process.exit(0);
}

backfillAugustToToday().catch(err => {
    console.error('Backfill Error:', err);
    process.exit(1);
});
