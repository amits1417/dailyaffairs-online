const express = require('express');
const cors = require('cors');
const path = require('path');
const storage = require('./services/storage');
const cronService = require('./services/cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API: Get current affairs questions
app.get('/api/current-affairs', async (req, res) => {
    try {
        const { date, lang = 'en', category, search } = req.query;
        const questions = await storage.getQuestions(date, lang, category, search);
        const dates = await storage.getAvailableDates();
        const selectedDate = date || (dates.length > 0 ? dates[0] : null);

        res.json({
            status: 'success',
            date: selectedDate,
            lang,
            count: questions.length,
            questions
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Get available dates
app.get('/api/dates', async (req, res) => {
    try {
        const dates = await storage.getAvailableDates();
        res.json({ status: 'success', dates });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Get categories
app.get('/api/categories', async (req, res) => {
    try {
        const categories = await storage.getCategories();
        res.json({ status: 'success', categories });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Trigger manual sync/scrape for a date
app.post('/api/sync', async (req, res) => {
    try {
        const { date } = req.body;
        const targetDate = date || (cronService.formatDate ? cronService.formatDate(new Date()) : '2026-08-02');

        const count = await cronService.syncDate(targetDate);
        res.json({ status: 'success', count, message: `Sync completed for date ${targetDate}` });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Sync ALL available dates from both sources
app.post('/api/sync-all', async (req, res) => {
    try {
        console.log('[API] Starting full sync from both sources...');
        cronService.autoSyncLatest().then(() => {
            console.log('[API] Full sync completed.');
        }).catch(err => {
            console.error('[API] Full sync error:', err);
        });
        res.json({ status: 'success', message: 'Full sync started. Check server logs for progress.' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: System status
app.get('/api/status', async (req, res) => {
    try {
        const dates = await storage.getAvailableDates();
        const totalQuestions = await storage.getQuestionCount();
        res.json({
            status: 'online',
            uptime: process.uptime(),
            totalQuestions,
            availableDates: dates.length,
            latestDate: dates[0] || null
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Vercel Cron endpoint
app.get('/api/cron/sync', async (req, res) => {
    try {
        console.log('[Cron] Vercel cron triggered - syncing latest...');
        await cronService.autoSyncLatest();
        res.json({ status: 'success', message: 'Cron sync completed' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// Start Server and Cron if executed directly
if (require.main === module) {
    storage.connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`===================================================`);
            console.log(`🚀 DailyAffairs.online Server Running`);
            console.log(`🌐 URL: http://localhost:${PORT}`);
            console.log(`===================================================`);

            cronService.initCron();
        });
    }).catch(err => {
        console.error('Failed to connect to MongoDB:', err);
        process.exit(1);
    });
}

module.exports = app;
