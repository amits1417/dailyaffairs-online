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
app.get('/api/current-affairs', (req, res) => {
    try {
        const { date, lang = 'en', category, search } = req.query;
        const questions = storage.getQuestions(date, lang, category, search);
        const dates = storage.getAvailableDates();
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
app.get('/api/dates', (req, res) => {
    try {
        const dates = storage.getAvailableDates();
        res.json({ status: 'success', dates });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

// API: Get categories
app.get('/api/categories', (req, res) => {
    try {
        const categories = storage.getCategories();
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

// API: System status
app.get('/api/status', (req, res) => {
    res.json({
        status: 'online',
        uptime: process.uptime(),
        availableDates: storage.getAvailableDates().length,
        latestDate: storage.getAvailableDates()[0] || null
    });
});

// Start Server and Cron if executed directly
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`===================================================`);
        console.log(`🚀 DailyAffairs.online Server Running`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`===================================================`);

        cronService.initCron();
    });
}

module.exports = app;
