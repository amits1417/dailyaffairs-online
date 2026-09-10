const cronService = require('../services/cron');
const storage = require('../services/storage');

/**
 * Backfill Current Affairs for July 2026 and August 2026 (2026-07-01 to 2026-08-31)
 */
async function backfillJulyAndAugust() {
    console.log('===========================================================');
    console.log('🚀 Starting July & August 2026 Backfill Scraper & Translator');
    console.log('===========================================================');

    const startDate = new Date('2026-07-01');
    const endDate = new Date('2026-08-31');

    const dateList = [];
    let current = new Date(endDate);

    while (current >= startDate) {
        dateList.push(cronService.formatDate(current));
        current.setDate(current.getDate() - 1);
    }

    console.log(`Generated ${dateList.length} dates for July and August 2026.`);

    const existingDates = new Set(storage.getAvailableDates());
    let syncedCount = 0;

    for (let i = 0; i < dateList.length; i++) {
        const dateStr = dateList[i];
        
        if (existingDates.has(dateStr)) {
            console.log(`[${i + 1}/${dateList.length}] Date ${dateStr} already present in DB. Skipping.`);
            continue;
        }

        console.log(`[${i + 1}/${dateList.length}] Scraping & Translating ${dateStr}...`);
        try {
            const count = await cronService.syncDate(dateStr);
            if (count > 0) {
                syncedCount++;
                console.log(`✅ Synced ${count} questions for ${dateStr}`);
            } else {
                console.log(`ℹ️ No questions found for ${dateStr}`);
            }
            // 800ms delay between dates
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (e) {
            console.error(`Error syncing ${dateStr}:`, e.message);
        }
    }

    console.log('===========================================================');
    console.log(`🎉 July & August 2026 Backfill Complete! Dates added: ${syncedCount}`);
    console.log('===========================================================');
    process.exit(0);
}

backfillJulyAndAugust().catch(err => {
    console.error('Backfill Error:', err);
    process.exit(1);
});
