const cron = require('node-cron');
const { scrapeIndiaBixDate, getLatestDatesFromIndex, formatDate } = require('./scraper');
const { scrapeGktodayDate, getLatestDatesFromGktodayIndex } = require('./gktoday-scraper');
const { deduplicateQuestions } = require('./deduplicator');
const { translateQuestionItem } = require('./translator');
const storage = require('./storage');

/**
 * Sync current affairs for a specific date from BOTH sources with deduplication
 */
async function syncDate(dateStr) {
    console.log(`[Sync] Starting sync for date: ${dateStr} from IndiaBIX + GKToday`);

    const [indiabixRaw, gktodayRaw] = await Promise.all([
        scrapeIndiaBixDate(dateStr).catch(e => {
            console.error(`[Sync] IndiaBIX error for ${dateStr}:`, e.message);
            return [];
        }),
        scrapeGktodayDate(dateStr).catch(e => {
            console.error(`[Sync] GKToday error for ${dateStr}:`, e.message);
            return [];
        })
    ]);

    console.log(`[Sync] IndiaBIX: ${indiabixRaw.length} questions, GKToday: ${gktodayRaw.length} questions`);

    const mergedQuestions = deduplicateQuestions(indiabixRaw, gktodayRaw);

    if (mergedQuestions.length === 0) {
        console.log(`[Sync] No questions found for ${dateStr} from any source`);
        return 0;
    }

    console.log(`[Sync] After dedup: ${mergedQuestions.length} unique questions for ${dateStr}`);
    console.log(`[Sync] Translating ${mergedQuestions.length} questions for ${dateStr}...`);
    const translatedList = (await Promise.all(
        mergedQuestions.map(item => translateQuestionItem(item).catch(e => {
            console.error(`[Sync] Failed translating qno ${item.qno}:`, e.message);
            return null;
        }))
    )).filter(Boolean);

    storage.saveQuestionsForDate(dateStr, translatedList);
    console.log(`[Sync] Completed sync for ${dateStr}. Total saved: ${translatedList.length}`);
    return translatedList.length;
}

/**
 * Sync today and recent days automatically from BOTH sources
 */
async function autoSyncLatest() {
    console.log('[AutoSync] Checking for latest daily updates from IndiaBIX + GKToday...');
    const todayStr = formatDate(new Date());

    await syncDate(todayStr);

    const [indiabixDates, gktodayDates] = await Promise.all([
        getLatestDatesFromIndex().catch(() => []),
        getLatestDatesFromGktodayIndex().catch(() => [])
    ]);

    const allDates = [...new Set([...indiabixDates, ...gktodayDates])].sort().reverse();
    const availableDates = storage.getAvailableDates();

    for (const d of allDates.slice(0, 10)) {
        if (!availableDates.includes(d)) {
            console.log(`[AutoSync] Found new date: ${d}`);
            await syncDate(d);
        }
    }
}

/**
 * Seed initial sample date if database is empty
 */
async function seedInitialData() {
    const existingDates = storage.getAvailableDates();
    if (existingDates.length === 0) {
        console.log('[Seed] Database empty. Seeding initial target date 2026-08-02...');
        await syncDate('2026-08-02');
        
        const todayStr = formatDate(new Date());
        if (todayStr !== '2026-08-02') {
            await syncDate(todayStr);
        }
    }
}

/**
 * Start cron job scheduler
 * Schedules:
 * 1) 4:00 AM (0 4 * * *)
 * 2) 1:00 PM (0 13 * * *)
 * 3) 9:00 PM (0 21 * * *)
 */
function initCron() {
    console.log('[Cron] Initializing 3x Daily Auto-Update Scheduler (4:00 AM, 1:00 PM, 9:00 PM)...');
    
    // Seed initial data if needed
    seedInitialData().catch(err => console.error('[Seed Error]', err));

    // 1) 4:00 AM Morning Cron
    cron.schedule('0 4 * * *', () => {
        console.log('[Cron - 4:00 AM] Executing morning sync...');
        autoSyncLatest().catch(err => console.error('[Cron Error]', err));
    });

    // 2) 1:00 PM Afternoon Cron
    cron.schedule('0 13 * * *', () => {
        console.log('[Cron - 1:00 PM] Executing afternoon sync...');
        autoSyncLatest().catch(err => console.error('[Cron Error]', err));
    });

    // 3) 9:00 PM Evening Cron
    cron.schedule('0 21 * * *', () => {
        console.log('[Cron - 9:00 PM] Executing night sync...');
        autoSyncLatest().catch(err => console.error('[Cron Error]', err));
    });
}

module.exports = {
    syncDate,
    autoSyncLatest,
    seedInitialData,
    initCron,
    formatDate
};
