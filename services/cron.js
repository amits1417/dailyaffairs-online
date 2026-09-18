const cron = require('node-cron');
const { scrapeIndiaBixDate, getLatestDatesFromIndex, formatDate } = require('./scraper');
const { scrapeGktodayDate, getLatestDatesFromGktodayIndex } = require('./gktoday-scraper');
const { deduplicateQuestions } = require('./deduplicator');
const { translateQuestionsBulk } = require('./translator');
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

    if (indiabixRaw.length === 0 && gktodayRaw.length === 0) {
        console.log(`[Sync] No new questions found for ${dateStr} from any source`);
        return 0;
    }

    const mergedQuestions = deduplicateQuestions(indiabixRaw, gktodayRaw);

    if (mergedQuestions.length === 0) {
        console.log(`[Sync] No questions left after deduplication for ${dateStr}`);
        return 0;
    }

    console.log(`[Sync] Translating ${mergedQuestions.length} questions for ${dateStr}...`);
    const translatedList = await translateQuestionsBulk(mergedQuestions);

    if (!translatedList || translatedList.length === 0) {
        console.log(`[Sync] Translation failed for ${dateStr}, skipping save`);
        return 0;
    }

    await storage.saveQuestionsForDate(dateStr, translatedList);
    console.log(`[Sync] Completed sync for ${dateStr}. Total saved: ${translatedList.length}`);
    return translatedList.length;
}

/**
 * Sync today and recent days automatically from BOTH sources
 */
async function autoSyncLatest() {
    console.log('[AutoSync] Checking for latest daily updates from both sources...');
    const todayStr = formatDate(new Date());

    const [indiabixDates, gktodayDates] = await Promise.all([
        getLatestDatesFromIndex().catch(() => []),
        getLatestDatesFromGktodayIndex().catch(() => [])
    ]);

    console.log(`[AutoSync] Discovered ${indiabixDates.length} IndiaBIX dates, ${gktodayDates.length} GKToday dates`);

    const availableDates = await storage.getAvailableDates(true);
    const candidateDates = [...new Set([todayStr, ...indiabixDates.slice(0, 20), ...gktodayDates.slice(0, 20)])].sort().reverse();

    let syncedCount = 0;
    for (const d of candidateDates) {
        const count = await storage.getQuestionCount(d);
        // Sync if missing, or if fewer than 8 questions, or if today
        if (!availableDates.includes(d) || count < 8 || d === todayStr) {
            console.log(`[AutoSync] Syncing active date: ${d} (Current in DB: ${count} questions)`);
            try {
                const added = await syncDate(d);
                if (added > 0) syncedCount++;
            } catch (err) {
                console.error(`[AutoSync] Error syncing date ${d}:`, err.message);
            }
        }
    }
    console.log(`[AutoSync] Finished daily update check. Synced dates: ${syncedCount}`);
}

/**
 * Seed initial sample date if database is empty
 */
async function seedInitialData() {
    const existingDates = await storage.getAvailableDates();
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
