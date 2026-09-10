const cronService = require('../services/cron');
const storage = require('../services/storage');

/**
 * Backfill past 1 year of daily current affairs dates
 */
async function backfillPastYear() {
    console.log('===========================================================');
    console.log('🚀 Starting 1-Year Historical Backfill Scraper & Translator');
    console.log('===========================================================');

    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const dateList = [];
    let current = new Date(today);

    while (current >= oneYearAgo) {
        dateList.push(cronService.formatDate(current));
        current.setDate(current.getDate() - 1);
    }

    console.log(`Generated ${dateList.length} dates to check/sync.`);

    const existingDates = new Set(storage.getAvailableDates());
    let syncedCount = 0;

    for (let i = 0; i < dateList.length; i++) {
        const dateStr = dateList[i];
        
        if (existingDates.has(dateStr)) {
            console.log(`[${i + 1}/${dateList.length}] Date ${dateStr} already present in DB. Skipping.`);
            continue;
        }

        console.log(`[${i + 1}/${dateList.length}] Processing date ${dateStr}...`);
        try {
            const count = await cronService.syncDate(dateStr);
            if (count > 0) {
                syncedCount++;
            }
            // Small pause between dates to be gentle on servers
            await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (e) {
            console.error(`Error syncing ${dateStr}:`, e.message);
        }
    }

    console.log('===========================================================');
    console.log(`🎉 1-Year Backfill Completed! Total dates added: ${syncedCount}`);
    console.log('===========================================================');
    process.exit(0);
}

backfillPastYear().catch(err => {
    console.error('Fatal Backfill Error:', err);
    process.exit(1);
});
