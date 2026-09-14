// Landing Page Functions
function openSection(mode) {
    const landing = document.getElementById('landingPage');
    const main = document.getElementById('mainContent');
    const btnHome = document.getElementById('btnHome');
    if (landing) landing.style.display = 'none';
    if (main) main.style.display = 'block';
    if (btnHome) btnHome.style.display = 'flex';
    switchViewMode(mode);
    localStorage.setItem('landing_done', 'true');
}

function goHome() {
    const landing = document.getElementById('landingPage');
    const main = document.getElementById('mainContent');
    const btnHome = document.getElementById('btnHome');
    if (landing) landing.style.display = 'flex';
    if (main) main.style.display = 'none';
    if (btnHome) btnHome.style.display = 'none';
    localStorage.removeItem('landing_done');
}

function checkLandingPage() {
    const landing = document.getElementById('landingPage');
    const main = document.getElementById('mainContent');
    const btnHome = document.getElementById('btnHome');
    if (!landing || !main) return;

    if (localStorage.getItem('landing_done')) {
        landing.style.display = 'none';
        main.style.display = 'block';
        if (btnHome) btnHome.style.display = 'flex';
    }
}

// Initial Font Size Sanitization (Bound between 12px and 22px for mobile compatibility)
let initialFontSize = parseInt(localStorage.getItem('user_font_size_px')) || 16;
if (initialFontSize < 12 || initialFontSize > 22) {
    initialFontSize = 16;
    localStorage.setItem('user_font_size_px', 16);
}

// App State
let state = {
    lang: localStorage.getItem('user_lang') || 'gu',
    fontSizePx: initialFontSize,
    englishFont: 'Inter',
    viewMode: 'daily', // 'daily' or 'topic'
    selectedMonth: 'All', // 'All', '2026-09', '2026-08'
    date: null,
    category: 'All',
    availableDates: [],
    questions: [],
    userAttempts: {}, // qid -> Array of attempted options ['A', 'C']
    revealedAnswers: {}, // qid -> boolean (true if right answer selected or View Explanation clicked)
    userComments: JSON.parse(localStorage.getItem('user_comments') || '{}'), // qid -> Array of {text, time}
    openComments: {}, // qid -> boolean
    activeTools: {}, // qid -> 'pen' | 'highlighter' | 'eraser' | null
    canvasDrawingData: JSON.parse(localStorage.getItem('user_canvas_data') || '{}') // qid -> dataURL
};

// Calendar Widget State & Month Names
let calendarState = {
    year: new Date().getFullYear(),
    month: new Date().getMonth()
};

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

// Multilingual UI Strings Dictionary
const UI_STRINGS_MAP = {
    gu: {
        noQuestions: 'પસંદ કરેલ માપદંડ માટે કોઈ પ્રશ્નો મળ્યા નથી.',
        viewAnswer: 'સમજૂતી અને જવાબ જુઓ',
        hideAnswer: 'સમજૂતી છુપાવો',
        workspace: 'નોટપેડ',
        answerPrefix: 'સાચો જવાબ:',
        explanationTitle: 'વિગતવાર વિશ્લેષણ અને સમજૂતી',
        workspacePlaceholder: 'અહીં તમારી ગણતરી અથવા નોંધ લખો...',
        comments: 'ટિપ્પણીઓ',
        postComment: 'પોસ્ટ કરો',
        commentPlaceholder: 'અહીં તમારી ટિપ્પણી અથવા નોંધ લખો...',
        noCommentsYet: 'હજુ સુધી કોઈ ટિપ્પણી નથી.',
        pen: 'પેન',
        highlight: 'હાઈલાઈટર',
        eraser: 'ઈરેઝર',
        clearMarkup: 'રીસેટ',
        optExcellent: 'excellent',
        optCorrect: 'correct',
        optWrong1: 'dont worry try hard',
        optWrong2: 'be caution',
        optWrong3: 'oops'
    },
    hi: {
        noQuestions: 'चयनित मानदंड के लिए कोई प्रश्न नहीं मिले।',
        viewAnswer: 'व्याख्या और उत्तर देखें',
        hideAnswer: 'व्याख्या छिपाएं',
        workspace: 'नोटपैड',
        answerPrefix: 'सही उत्तर:',
        explanationTitle: 'विस्तृत विश्लेषण और व्याख्या',
        workspacePlaceholder: 'अपनी टिप्पणी या गणना यहाँ लिखें...',
        comments: 'टिप्पणियाँ',
        postComment: 'पोस्ट करें',
        commentPlaceholder: 'अपनी टिप्पणी या नोट यहाँ लिखें...',
        noCommentsYet: 'अभी तक कोई टिप्पणी नहीं।',
        pen: 'पेन',
        highlight: 'हाइलाइटर',
        eraser: 'इरेज़र',
        clearMarkup: 'रीसेट',
        optExcellent: 'excellent',
        optCorrect: 'correct',
        optWrong1: 'dont worry try hard',
        optWrong2: 'be caution',
        optWrong3: 'oops'
    },
    en: {
        noQuestions: 'No questions found for the selected criteria.',
        viewAnswer: 'View Explanation',
        hideAnswer: 'Hide Explanation',
        workspace: 'Scratchpad',
        answerPrefix: 'Correct Answer:',
        explanationTitle: 'Detailed Analysis & Explanation',
        workspacePlaceholder: 'Type your rough notes or calculations here...',
        comments: 'Comments',
        postComment: 'Post',
        commentPlaceholder: 'Write a comment or note...',
        noCommentsYet: 'No comments yet.',
        pen: 'Pen',
        highlight: 'Highlighter',
        eraser: 'Eraser',
        clearMarkup: 'Reset',
        optExcellent: 'excellent',
        optCorrect: 'correct',
        optWrong1: 'dont worry try hard',
        optWrong2: 'be caution',
        optWrong3: 'oops'
    }
};

Object.defineProperty(window, 'UI_STRINGS', {
    get: function() {
        return UI_STRINGS_MAP[state.lang] || UI_STRINGS_MAP['gu'];
    }
});

// Side Menu Drawer Toggle Logic
function toggleMenuDrawer() {
    const drawer = document.getElementById('menuDrawer');
    if (drawer) drawer.classList.toggle('show');
}

function closeMenuDrawer() {
    const drawer = document.getElementById('menuDrawer');
    if (drawer) drawer.classList.remove('show');
}

// English Font System (Global Inter Font)
function applyEnglishFont() {
    const fontStack = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
    document.documentElement.style.setProperty('--user-font-english', fontStack);
}

// Switch View Mode (Daily vs Topic-Wise)
function switchViewMode(mode) {
    state.viewMode = mode;

    const drawerItemDaily = document.getElementById('drawerItemDaily');
    const drawerItemTopic = document.getElementById('drawerItemTopic');
    if (drawerItemDaily) drawerItemDaily.classList.toggle('active', mode === 'daily');
    if (drawerItemTopic) drawerItemTopic.classList.toggle('active', mode === 'topic');

    const topicControlsBar = document.getElementById('topicControlsBar');
    const headerDateGroup = document.getElementById('headerDateGroup');
    const pageTitleIcon = document.getElementById('pageTitleIcon');
    const pageTitleText = document.getElementById('pageTitleText');

    if (mode === 'daily') {
        if (topicControlsBar) topicControlsBar.style.display = 'none';
        if (headerDateGroup) headerDateGroup.style.display = 'flex';
        if (pageTitleIcon) pageTitleIcon.className = 'ri-flashlight-line';
        if (pageTitleText) pageTitleText.innerText = 'Daily Current Affairs & Analysis';
        state.category = 'All';
        state.selectedMonth = 'All';
    } else {
        if (topicControlsBar) topicControlsBar.style.display = 'block';
        if (headerDateGroup) headerDateGroup.style.display = 'none';
        if (pageTitleIcon) pageTitleIcon.className = 'ri-price-tag-3-line';
        if (pageTitleText) pageTitleText.innerText = 'Topic-Wise Current Affairs & Practice';
    }

    fetchQuestions();
}

function filterTopicWise() {
    const monthSel = document.getElementById('monthSelect');
    const catSel = document.getElementById('categorySelect');
    if (monthSel) state.selectedMonth = monthSel.value;
    if (catSel) state.category = catSel.value;
    fetchQuestions();
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    checkLandingPage();
    loadLandingStats();

    if (!localStorage.getItem('user_lang')) {
        document.getElementById('languageModal').classList.add('show');
    }

    applyLanguage(state.lang);
    applyFontSizePx(state.fontSizePx);
    applyEnglishFont(state.englishFont);
    await fetchDates();
    // Questions + categories in parallel instead of waterfall
    await Promise.all([fetchQuestions(), fetchCategories()]);
});

async function loadLandingStats() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.status === 'online') {
            document.getElementById('landingTotalQ').textContent = data.totalQuestions.toLocaleString();
            document.getElementById('landingTotalDays').textContent = data.availableDates;
        }
    } catch(e) {}
}

// Font Size Stepper Controller (Safe Range: 12px to 22px)
function adjustFontSize(delta) {
    let newSize = state.fontSizePx + delta;
    if (newSize < 12) newSize = 12;
    if (newSize > 22) newSize = 22;

    state.fontSizePx = newSize;
    localStorage.setItem('user_font_size_px', newSize);
    applyFontSizePx(newSize);
}

function resetFontSize() {
    state.fontSizePx = 16;
    localStorage.setItem('user_font_size_px', 16);
    applyFontSizePx(16);
}

function applyFontSizePx(px) {
    document.documentElement.style.setProperty('--user-base-font-size', `${px}px`);
}

// Date Format Helper (YYYY-MM-DD -> DD-MM-YYYY)
function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
}

// Language Selectors
function selectInitialLanguage(selectedLang) {
    state.lang = selectedLang;
    localStorage.setItem('user_lang', selectedLang);
    document.getElementById('languageModal').classList.remove('show');
    applyLanguage(selectedLang);
    fetchQuestions();
}

function switchLanguage(newLang) {
    if (state.lang === newLang) return;
    state.lang = newLang;
    localStorage.setItem('user_lang', newLang);
    applyLanguage(newLang);
    fetchQuestions();
}

function applyLanguage(lang) {
    const guBtn = document.getElementById('btnLangGu');
    const hiBtn = document.getElementById('btnLangHi');
    const enBtn = document.getElementById('btnLangEn');
    if (guBtn) guBtn.classList.toggle('active', lang === 'gu');
    if (hiBtn) hiBtn.classList.toggle('active', lang === 'hi');
    if (enBtn) enBtn.classList.toggle('active', lang === 'en');

    const guBtnMob = document.getElementById('btnLangGuMob');
    const hiBtnMob = document.getElementById('btnLangHiMob');
    const enBtnMob = document.getElementById('btnLangEnMob');
    if (guBtnMob) guBtnMob.classList.toggle('active', lang === 'gu');
    if (hiBtnMob) hiBtnMob.classList.toggle('active', lang === 'hi');
    if (enBtnMob) enBtnMob.classList.toggle('active', lang === 'en');

    const guBtnTop = document.getElementById('btnLangGuTop');
    const hiBtnTop = document.getElementById('btnLangHiTop');
    const enBtnTop = document.getElementById('btnLangEnTop');
    if (guBtnTop) guBtnTop.classList.toggle('active', lang === 'gu');
    if (hiBtnTop) hiBtnTop.classList.toggle('active', lang === 'hi');
    if (enBtnTop) enBtnTop.classList.toggle('active', lang === 'en');
}

// Fetch available dates
async function fetchDates() {
    try {
        const response = await fetch('/api/dates');
        const data = await response.json();
        if (data.status === 'success' && data.dates.length > 0) {
            state.availableDates = data.dates;
            if (!state.date) {
                state.date = data.dates[0]; // Default to latest date
            }
            initCalendarStateFromDate(state.date);
        }
    } catch (e) {
        console.error('Error fetching dates:', e);
    }
}

function initCalendarStateFromDate(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        calendarState.year = parseInt(parts[0]);
        calendarState.month = parseInt(parts[1]) - 1;
    }
}

// Fetch Questions
// Client-side prefetch cache: key = date|lang|category -> questions (instant day-nav)
state.prefetchCache = state.prefetchCache || new Map();

function getPrefetchKey(date, lang, category) {
    return `${date || ''}|${lang || 'gu'}|${category || ''}`;
}

async function fetchQuestions() {
    // Reset option selections and revealed answers when changing date/mode/filters
    state.userAttempts = {};
    state.revealedAnswers = {};
    state.userAnswers = {};

    const questionsContainer = document.getElementById('questionsList');

    const dayNavBar = document.getElementById('dayNavBar');
    const dayNavBarTop = document.getElementById('dayNavBarTop');
    if (dayNavBar) dayNavBar.style.display = 'none';
    if (dayNavBarTop) dayNavBarTop.style.display = 'none';

    try {
        const langParam = state.lang || 'gu';
        let url = `/api/current-affairs?lang=${langParam}`;

        const isTopicMonth = state.viewMode === 'topic' && state.selectedMonth && state.selectedMonth !== 'All';
        if (state.viewMode === 'topic') {
            if (isTopicMonth) {
                // Server-side month filter: downloads ~300 Q instead of 6600+
                url += `&month=${state.selectedMonth}`;
            } else {
                url += '&date=all';
            }
        } else if (state.date) {
            url += `&date=${state.date}`;
        }

        if (state.category && state.category !== 'All') {
            url += `&category=${encodeURIComponent(state.category)}`;
        }

        // Instant render from prefetch cache (daily mode, no filters)
        const prefetchKey = getPrefetchKey(state.date, langParam, state.category);
        const usePrefetch = state.viewMode === 'daily' && (!state.category || state.category === 'All') && state.prefetchCache.has(prefetchKey);
        if (!usePrefetch) {
            questionsContainer.innerHTML = '<div style="text-align:center; padding: 40px;"><i class="ri-loader-4-line ri-spin" style="font-size:2rem; color:var(--primary-color);"></i></div>';
        }

        const response = usePrefetch ? null : await fetch(url);
        const data = usePrefetch ? state.prefetchCache.get(prefetchKey) : await response.json();

        if (data.status === 'success') {
            let questions = data.questions;

            if (state.viewMode === 'topic' && !isTopicMonth && state.selectedMonth && state.selectedMonth !== 'All') {
                questions = questions.filter(q => q.date && q.date.startsWith(state.selectedMonth));
            }

            state.questions = questions;
            if (data.date && state.viewMode === 'daily') {
                state.date = data.date;
                const formattedDate = formatDisplayDate(data.date);
                const txtHeaderDate = document.getElementById('txtHeaderDate');
                if (txtHeaderDate) txtHeaderDate.innerText = formattedDate;
                const txtDayNavCurrentDate = document.getElementById('txtDayNavCurrentDate');
                if (txtDayNavCurrentDate) txtDayNavCurrentDate.innerText = `Date: ${formattedDate}`;
                initCalendarStateFromDate(data.date);
            }

            if (data.questions.length === 0 && state.date && state.viewMode === 'daily') {
                renderEmptyStateWithAutoSync(state.date);
            } else {
                renderQuestions();
                if (state.viewMode === 'daily') {
                    if (dayNavBar) dayNavBar.style.display = 'flex';
                    if (dayNavBarTop) dayNavBarTop.style.display = 'flex';
                    updateDayNavButtons();
                    prefetchNeighborDates();
                }
            }
            fetchCategories();
        }
    } catch (e) {
        console.error('Error fetching questions:', e);
        questionsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color:var(--error-text);">Failed to load current affairs. Please try syncing.</div>`;
    }
}

// Prefetch previous/next day in background so day navigation feels instant
function prefetchNeighborDates() {
    try {
        if (!state.date || !state.availableDates || state.availableDates.length === 0) return;
        const idx = state.availableDates.indexOf(state.date);
        if (idx === -1) return;
        const neighbors = [];
        if (idx > 0) neighbors.push(state.availableDates[idx - 1]);
        if (idx < state.availableDates.length - 1) neighbors.push(state.availableDates[idx + 1]);

        const langParam = state.lang || 'gu';
        const run = () => {
            neighbors.forEach(d => {
                const key = getPrefetchKey(d, langParam, state.category);
                if (state.prefetchCache.has(key)) return;
                fetch(`/api/current-affairs?lang=${langParam}&date=${d}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data && data.status === 'success') {
                            if (state.prefetchCache.size > 30) {
                                const oldest = state.prefetchCache.keys().next().value;
                                state.prefetchCache.delete(oldest);
                            }
                            state.prefetchCache.set(key, data);
                        }
                    })
                    .catch(() => {});
            });
        };
        if ('requestIdleCallback' in window) {
            requestIdleCallback(run, { timeout: 2000 });
        } else {
            setTimeout(run, 800);
        }
    } catch (e) {}
}

// Empty State Auto Sync
function renderEmptyStateWithAutoSync(dateStr) {
    const container = document.getElementById('questionsList');
    container.innerHTML = `
    <div class="ques-card" style="text-align:center; padding:50px;">
        <i class="ri-calendar-todo-line" style="font-size:3rem; color:var(--primary-color); margin-bottom:12px;"></i>
        <div style="font-size:1.2rem; font-weight:700; color:var(--text-dark); margin-bottom:8px;">No Current Affairs Cached for ${dateStr}</div>
        <div style="color:var(--text-muted); font-size:0.95rem; margin-bottom:20px;">Click below to fetch questions for this date.</div>
        <button class="btn-tool" onclick="syncSpecificDate('${dateStr}')" style="margin: 0 auto; background:var(--primary-color); color:white; padding:10px 24px;">
            <i class="ri-download-cloud-line"></i> Fetch Questions for ${formatDisplayDate(dateStr)}
        </button>
    </div>
    `;
    document.getElementById('dayNavBar').style.display = 'flex';
    updateDayNavButtons();
}

async function syncSpecificDate(dateStr) {
    const questionsContainer = document.getElementById('questionsList');
    questionsContainer.innerHTML = `<div style="text-align:center; padding: 50px;"><i class="ri-loader-4-line ri-spin" style="font-size:2.4rem; color:var(--primary-color);"></i><div style="margin-top:12px; font-weight:700; color:var(--primary-color);">Scraping & Translating Current Affairs for ${formatDisplayDate(dateStr)}...</div></div>`;

    try {
        await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: dateStr })
        });

        await fetchDates();
        await fetchQuestions();
    } catch (e) {
        console.error('Sync failed for date:', e);
        questionsContainer.innerHTML = `<div style="text-align:center; padding:40px; color:var(--error-text);">Sync failed. Please check your internet connection and try again.</div>`;
    }
}

// Fetch categories
async function fetchCategories() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        if (data.status === 'success') {
            renderCategories(data.categories);
        }
    } catch (e) {
        console.error('Error fetching categories:', e);
    }
}

function renderCategories(categories) {
    const selectEl = document.getElementById('categorySelect');
    if (!selectEl) return;

    let html = `<option value="All" ${state.category === 'All' ? 'selected' : ''}>All Topics & Categories</option>`;
    
    categories.forEach(cat => {
        const isSel = state.category.toLowerCase() === cat.toLowerCase() ? 'selected' : '';
        html += `<option value="${cat}" ${isSel}>${cat}</option>`;
    });

    selectEl.innerHTML = html;
}

function filterCategory(cat) {
    state.category = cat;
    fetchQuestions();
}

function handleSearch() {
    state.search = document.getElementById('searchInput').value.trim();
    fetchQuestions();
}

// Topic Image Resolver (Disabled - Images removed as requested)
function getRelevantTopicImage(q) {
    return null;
}

// SMART BLUE TEXT HIGHLIGHTER (No Bold, No Underline, No BG, Clean Spacing)
function highlightImportantTerms(text) {
    if (!text || typeof text !== 'string') return '';

    let formatted = text;

    // 1. Highlight Key Named Organizations, Entities & Locations
    const entityPattern = /\b(ISRO|RBI|UNESCO|DRDO|SEBI|NITI Aayog|G20|BRICS|ASEAN|COP29|GST|GDP|PM Modi|Narendra Modi|Ladakh|Indian Navy|Indian Army|Indian Air Force|Supreme Court|World Bank|IMF|UNICEF|ઈસરો|આરબીઆઈ|લદ્દાખ|વડાપ્રધાન|ગુજરાત|રાજસ્થાન|इसरो|आरबीआई|लद्दाख|प्रधानमंत्री|गुजरात|राजस्थान)\b/gi;
    formatted = formatted.replace(entityPattern, (match) => `<span class="highlight-blue">${match}</span>`);

    // 2. Highlight Key Financial Amounts, Percentages & Quantities with Units
    const metricsPattern = /(\b(202\d|19\d\d)\b|\b₹[\d,.]+\s*(crore|lakh|billion)?|\b\d+(\.\d+)?\s*(%|percent|sq km|crore|lakh|billion|million|GB|MB|ચોરસ કિલોમીટર|કરોડ|લાખ|ટકા|करोड़|लाख|प्रतिशत))\b/gi;
    formatted = formatted.replace(metricsPattern, (match) => `<span class="highlight-blue">${match}</span>`);

    return formatted;
}

// Render Question Cards
function renderQuestions() {
    const container = document.getElementById('questionsList');
    const langClass = `lang-content-${state.lang}`;

    if (!state.questions || state.questions.length === 0) {
        container.innerHTML = `<div class="ques-card" style="text-align:center; padding:50px; color:var(--text-muted);">${UI_STRINGS.noQuestions}</div>`;
        return;
    }

    let html = '';
    state.questions.forEach((q, idx) => {
        const isRevealed = Boolean(state.revealedAnswers[q.id]);
        const topicImageUrl = getRelevantTopicImage(q);
        const highlightedExplanation = highlightImportantTerms(q.explanation);
        const isCommentsOpen = Boolean(state.openComments[q.id]);
        const commentCount = getCommentCount(q.id);
        const activeTool = state.activeTools[q.id];

        html += `
        <div class="ques-card" id="card-${q.id}">
            <div class="ques-card-split">
                <!-- LEFT COLUMN: QUESTION & OPTIONS -->
                <div class="ques-left-col">
                    <div class="ques-meta">
                        <span class="ques-num">Q${q.qno}.</span>
                        <span class="category-tag">${q.category || 'General'}</span>
                    </div>
                    
                    <div class="ques-text ${langClass}">${q.question}</div>

                    <div class="options-list ${langClass}">
                        ${renderOption(q, 'A')}
                        ${renderOption(q, 'B')}
                        ${renderOption(q, 'C')}
                        ${renderOption(q, 'D')}
                    </div>

                    <div class="card-toolbar">
                        <button class="btn-tool ${isRevealed ? 'active' : ''}" onclick="toggleAnswer('${q.id}')">
                            <i class="ri-book-open-line"></i>
                            <span id="btnAnsText-${q.id}">${isRevealed ? UI_STRINGS.hideAnswer : UI_STRINGS.viewAnswer}</span>
                        </button>

                        <button class="btn-tool" onclick="toggleWorkspace('${q.id}')">
                            <i class="ri-edit-line"></i>
                            <span>${UI_STRINGS.workspace}</span>
                        </button>

                        <button class="btn-tool ${isCommentsOpen ? 'active' : ''}" onclick="toggleComments('${q.id}')">
                            <i class="ri-chat-3-line"></i>
                            <span>${UI_STRINGS.comments} <span id="commentCount-${q.id}">(${commentCount})</span></span>
                        </button>
                    </div>
                </div>

                <!-- RIGHT COLUMN: EXPLANATION & ANALYSIS (Blank until right answer is selected or View Explanation clicked) -->
                <div class="ques-right-col">
                    <div class="explanation-box ${isRevealed ? 'show' : ''}" id="expBox-${q.id}">
                        <canvas class="exp-drawing-canvas ${activeTool ? 'active-canvas cursor-' + activeTool : ''}" id="canvas-${q.id}"></canvas>

                        <div class="exp-header-row" style="position:relative; z-index:10; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:10px;">
                            <div class="ans-badge" style="margin-bottom:0;">${UI_STRINGS.answerPrefix} Option ${q.answer}</div>
                            
                            <!-- Icon-Only Freehand Tools Bar with Hover Tooltips -->
                            <div class="exp-tools-bar" style="margin-bottom:0; padding-bottom:0; border-bottom:none;">
                                <button class="btn-exp-tool btn-tool-icon ${activeTool === 'pen' ? 'active-pen' : ''}" id="btnPen-${q.id}" onclick="toggleExpTool('${q.id}', 'pen')" title="Red Pen (Draw Freehand)">
                                    <i class="ri-edit-2-line"></i>
                                </button>
                                <button class="btn-exp-tool btn-tool-icon ${activeTool === 'highlighter' ? 'active-hl' : ''}" id="btnHL-${q.id}" onclick="toggleExpTool('${q.id}', 'highlighter')" title="Neon Green Highlighter">
                                    <i class="ri-mark-pen-line"></i>
                                </button>
                                <button class="btn-exp-tool btn-tool-icon ${activeTool === 'eraser' ? 'active-eraser' : ''}" id="btnEraser-${q.id}" onclick="toggleExpTool('${q.id}', 'eraser')" title="Eraser (Erase Drawing)">
                                    <i class="ri-eraser-line"></i>
                                </button>
                                <button class="btn-exp-tool btn-tool-icon" onclick="clearExpCanvas('${q.id}')" title="Reset / Clear All Drawings">
                                    <i class="ri-refresh-line"></i>
                                </button>
                            </div>
                        </div>

                        ${topicImageUrl ? `<img src="${topicImageUrl}" alt="Topic Image" class="explanation-side-img" loading="lazy" onerror="this.style.display='none'" style="position:relative; z-index:4;">` : ''}

                        <div class="explanation-text ${langClass}" id="expText-${q.id}" style="position:relative; z-index:4;">${highlightedExplanation}</div>
                    </div>
                </div>
            </div>

            <!-- Workspace Scratchpad -->
            <div class="workspace-box" id="workBox-${q.id}">
                <textarea placeholder="${UI_STRINGS.workspacePlaceholder}"></textarea>
            </div>

            <!-- User Comments Box -->
            <div class="comments-box ${isCommentsOpen ? 'show' : ''}" id="commentsBox-${q.id}">
                <div class="comments-header">
                    <div class="comments-title"><i class="ri-chat-3-line"></i> ${UI_STRINGS.comments}</div>
                </div>
                <div class="comments-list" id="commentsList-${q.id}">
                    ${renderCommentsHtml(q.id)}
                </div>
                <div class="comment-input-group">
                    <input type="text" id="commentInput-${q.id}" placeholder="${UI_STRINGS.commentPlaceholder}" onkeypress="if(event.key==='Enter') addComment('${q.id}')">
                    <button class="btn-tool btn-add-comment" onclick="addComment('${q.id}')">
                        <i class="ri-send-plane-fill"></i> ${UI_STRINGS.postComment}
                    </button>
                </div>
            </div>
        </div>
        `;
    });

    container.innerHTML = html;
    initAllQuestionCanvases();
}

// Render Individual Option
function renderOption(q, optKey) {
    const optText = q.options ? q.options[optKey] : '';
    if (!optText) return '';

    const attempts = state.userAttempts[q.id] || [];
    const isRevealed = Boolean(state.revealedAnswers[q.id]);
    const hasAttemptedThis = attempts.includes(optKey);
    const isCorrectOpt = (optKey === q.answer);

    let classNames = 'option-item';
    let badgeText = '';
    let badgeClass = '';

    if (hasAttemptedThis) {
        const attemptIndex = attempts.indexOf(optKey); // 0 = 1st try, 1 = 2nd try, 2 = 3rd try

        if (isCorrectOpt) {
            classNames += ' selected-correct';
            if (attemptIndex === 0) {
                badgeText = UI_STRINGS.optExcellent;
                badgeClass = 'opt-badge-excellent';
            } else {
                badgeText = UI_STRINGS.optCorrect;
                badgeClass = 'opt-badge-correct';
            }
        } else {
            classNames += ' selected-wrong';
            if (attemptIndex === 0) {
                badgeText = UI_STRINGS.optWrong1;
                badgeClass = 'opt-badge-wrong1';
            } else if (attemptIndex === 1) {
                badgeText = UI_STRINGS.optWrong2;
                badgeClass = 'opt-badge-wrong2';
            } else {
                badgeText = UI_STRINGS.optWrong3;
                badgeClass = 'opt-badge-wrong3';
            }
        }
    } else if (isRevealed && isCorrectOpt) {
        classNames += ' highlight-correct';
    }

    return `
    <div class="${classNames}" onclick="handleOptionClick('${q.id}', '${optKey}')">
        <div class="option-letter">${optKey}</div>
        <div class="option-text">${optText}</div>
        ${badgeText ? `<span class="option-status-text ${badgeClass}">${badgeText}</span>` : ''}
    </div>
    `;
}

// Option Click Handler (Only reveals right answer & explanation when CORRECT answer is clicked!)
function handleOptionClick(qid, selectedOpt) {
    const q = state.questions.find(item => item.id === qid);
    if (!q) return;

    if (!state.userAttempts[qid]) {
        state.userAttempts[qid] = [];
    }

    if (!state.userAttempts[qid].includes(selectedOpt)) {
        state.userAttempts[qid].push(selectedOpt);
    }

    if (selectedOpt === q.answer) {
        state.revealedAnswers[qid] = true;
    }

    renderQuestions();
}

// Toggle Answer & Explanation
function toggleAnswer(qid) {
    state.revealedAnswers[qid] = !Boolean(state.revealedAnswers[qid]);
    renderQuestions();
}

// PDF EXPORT CONTROLLERS & GENERATOR
function openPdfExportModal() {
    fetchCategoriesForPdf();
    const modal = document.getElementById('pdfExportModal');
    if (modal) modal.classList.add('show');
}

function closePdfExportModal() {
    const modal = document.getElementById('pdfExportModal');
    if (modal) modal.classList.remove('show');
}

function togglePdfExportType(type) {
    const monthSection = document.getElementById('pdfMonthSection');
    const customSection = document.getElementById('pdfCustomDateSection');
    
    if (type === 'month') {
        if (monthSection) monthSection.style.display = 'block';
        if (customSection) customSection.style.display = 'none';
    } else {
        if (monthSection) monthSection.style.display = 'none';
        if (customSection) customSection.style.display = 'block';
    }
}

async function fetchCategoriesForPdf() {
    try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        if (data.status === 'success') {
            const selectEl = document.getElementById('pdfSelectCategory');
            if (selectEl) {
                let html = '<option value="All">All Topics & Categories</option>';
                data.categories.forEach(cat => {
                    html += `<option value="${cat}">${cat}</option>`;
                });
                selectEl.innerHTML = html;
            }
        }
    } catch (e) {
        console.error('Failed fetching categories for PDF:', e);
    }
}

async function generatePdfExport() {
    const exportType = document.querySelector('input[name="pdfExportType"]:checked')?.value || 'month';
    const selectedCategory = document.getElementById('pdfSelectCategory')?.value || 'All';
    const lang = state.lang || 'gu';

    let questionsToExport = [];

    try {
        const response = await fetch(`/api/current-affairs?lang=${lang}&date=all`);
        const data = await response.json();

        if (data.status !== 'success' || !data.questions || data.questions.length === 0) {
            alert('No current affairs questions found to export.');
            return;
        }

        let questions = data.questions;

        if (exportType === 'month') {
            const monthVal = document.getElementById('pdfSelectMonth')?.value || 'All';
            if (monthVal !== 'All') {
                questions = questions.filter(q => q.date && q.date.startsWith(monthVal));
            }
        } else {
            const startDate = document.getElementById('pdfStartDate')?.value;
            const endDate = document.getElementById('pdfEndDate')?.value;
            
            if (startDate) {
                questions = questions.filter(q => q.date >= startDate);
            }
            if (endDate) {
                questions = questions.filter(q => q.date <= endDate);
            }
        }

        if (selectedCategory !== 'All') {
            questions = questions.filter(q => q.category && q.category.toLowerCase() === selectedCategory.toLowerCase());
        }

        if (questions.length === 0) {
            alert('No questions matched the selected date range and category.');
            return;
        }

        questionsToExport = questions;
    } catch (e) {
        console.error('Error preparing PDF data:', e);
        alert('Failed to generate PDF export data.');
        return;
    }

    closePdfExportModal();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Pop-up blocker prevented opening the printable PDF window. Please allow pop-ups for this site.');
        return;
    }

    const langFontFamily = (lang === 'gu') ? "'Hind Vadodara', sans-serif" : "var(--user-font-english, 'SF Pro Display', sans-serif)";

    let pdfHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>DailyAffairs.online - Current Affairs PDF Export</title>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Hind+Vadodara:wght@400;500;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            @page {
                size: A4;
                margin: 15mm 15mm;
            }
            body {
                font-family: ${langFontFamily};
                color: #1e293b;
                line-height: 1.5;
                margin: 0;
                padding: 20px;
                background: #ffffff;
            }
            .header-banner {
                border-bottom: 2.5px solid #2563eb;
                padding-bottom: 12px;
                margin-bottom: 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .brand-name {
                font-size: 22px;
                font-weight: 800;
                color: #2563eb;
            }
            .export-meta {
                font-size: 13px;
                color: #64748b;
                text-align: right;
            }
            .pdf-card {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 18px;
                page-break-inside: avoid;
                background: #f8fafc;
            }
            .pdf-meta {
                display: flex;
                gap: 10px;
                align-items: center;
                margin-bottom: 8px;
            }
            .pdf-num {
                background: #2563eb;
                color: white;
                font-weight: 700;
                font-size: 12px;
                padding: 2px 8px;
                border-radius: 4px;
            }
            .pdf-cat {
                background: #e0e7ff;
                color: #3730a3;
                font-size: 12px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 4px;
            }
            .pdf-date {
                font-size: 12px;
                color: #64748b;
                margin-left: auto;
            }
            .pdf-question {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 12px;
            }
            .pdf-options {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 12px;
            }
            .pdf-opt {
                background: white;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 13px;
                display: flex;
                gap: 8px;
            }
            .pdf-opt-key {
                font-weight: 700;
                color: #2563eb;
            }
            .pdf-ans-box {
                background: #dcfce7;
                border: 1px solid #86efac;
                color: #166534;
                font-weight: 700;
                font-size: 13px;
                padding: 6px 12px;
                border-radius: 6px;
                margin-bottom: 8px;
                display: inline-block;
            }
            .pdf-exp-box {
                background: white;
                border-left: 3px solid #2563eb;
                padding: 10px 14px;
                font-size: 13.5px;
                color: #334155;
            }
            .pdf-exp-title {
                font-weight: 700;
                color: #1e40af;
                margin-bottom: 4px;
                font-size: 13px;
            }
            .highlight-blue {
                color: #2563eb;
            }
            @media print {
                body { padding: 0; }
                .pdf-card { break-inside: avoid; }
            }
        </style>
    </head>
    <body>
        <div class="header-banner">
            <div>
                <div class="brand-name">DailyAffairs.online - Current Affairs</div>
                <div style="font-size:13px; color:#475569; font-weight:600;">Daily Multilingual Current Affairs & Detailed Analysis</div>
            </div>
            <div class="export-meta">
                <div><strong>Total Questions:</strong> ${questionsToExport.length}</div>
                <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
            </div>
        </div>
    `;

    questionsToExport.forEach((q, idx) => {
        const highlightedExp = highlightImportantTerms(q.explanation || '');
        pdfHtml += `
        <div class="pdf-card">
            <div class="pdf-meta">
                <span class="pdf-num">Q${idx + 1}</span>
                <span class="pdf-cat">${q.category || 'General'}</span>
                <span class="pdf-date">Date: ${formatDisplayDate(q.date)}</span>
            </div>
            <div class="pdf-question">${q.question}</div>
            
            <div class="pdf-options">
                <div class="pdf-opt"><span class="pdf-opt-key">A.</span> ${q.options ? q.options.A : ''}</div>
                <div class="pdf-opt"><span class="pdf-opt-key">B.</span> ${q.options ? q.options.B : ''}</div>
                <div class="pdf-opt"><span class="pdf-opt-key">C.</span> ${q.options ? q.options.C : ''}</div>
                <div class="pdf-opt"><span class="pdf-opt-key">D.</span> ${q.options ? q.options.D : ''}</div>
            </div>

            <div class="pdf-ans-box">${UI_STRINGS.answerPrefix} Option ${q.answer}</div>
            
            <div class="pdf-exp-box">
                <div class="pdf-exp-title">${UI_STRINGS.explanationTitle}</div>
                <div>${highlightedExp}</div>
            </div>
        </div>
        `;
    });

    pdfHtml += `
        <script>
            window.onload = function() {
                setTimeout(function() {
                    window.print();
                }, 500);
            };
        </script>
    </body>
    </html>
    `;

    printWindow.document.write(pdfHtml);
    printWindow.document.close();
}

function toggleWorkspace(qid) {
    const workBox = document.getElementById(`workBox-${qid}`);
    if (workBox) {
        workBox.classList.toggle('show');
    }
}

// DAY NAVIGATION (PREVIOUS DAY / NEXT DAY)
function updateDayNavButtons() {
    if (!state.date) return;

    const currDate = new Date(state.date);
    
    const prevDateObj = new Date(currDate);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevStr = formatDateObj(prevDateObj);

    const nextDateObj = new Date(currDate);
    nextDateObj.setDate(nextDateObj.getDate() + 1);
    const nextStr = formatDateObj(nextDateObj);

    const prevLabel = `Previous Day (${formatDisplayDate(prevStr)})`;
    const nextLabel = `Next Day (${formatDisplayDate(nextStr)})`;
    const dateLabel = `Date: ${formatDisplayDate(state.date)}`;

    const txtPrevBtn = document.getElementById('txtPrevDayBtn');
    const txtNextBtn = document.getElementById('txtNextDayBtn');
    const txtDateNav = document.getElementById('txtDayNavCurrentDate');

    if (txtPrevBtn) txtPrevBtn.innerText = prevLabel;
    if (txtNextBtn) txtNextBtn.innerText = nextLabel;
    if (txtDateNav) txtDateNav.innerText = dateLabel;

    const txtPrevBtnTop = document.getElementById('txtPrevDayBtnTop');
    const txtNextBtnTop = document.getElementById('txtNextDayBtnTop');
    const txtDateNavTop = document.getElementById('txtDayNavCurrentDateTop');

    if (txtPrevBtnTop) txtPrevBtnTop.innerText = prevLabel;
    if (txtNextBtnTop) txtNextBtnTop.innerText = nextLabel;
    if (txtDateNavTop) txtDateNavTop.innerText = dateLabel;
}

function navigateDay(delta) {
    if (!state.date) return;
    const currDate = new Date(state.date);
    currDate.setDate(currDate.getDate() + delta);
    const newDateStr = formatDateObj(currDate);
    
    state.date = newDateStr;
    fetchQuestions();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// USER COMMENTS SYSTEM & PERSISTENCE
function getCommentCount(qid) {
    const list = state.userComments[qid] || [];
    return list.length;
}

function toggleComments(qid) {
    state.openComments[qid] = !Boolean(state.openComments[qid]);
    const box = document.getElementById(`commentsBox-${qid}`);
    if (box) {
        box.classList.toggle('show', Boolean(state.openComments[qid]));
    }
}

function addComment(qid) {
    const input = document.getElementById(`commentInput-${qid}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!state.userComments[qid]) {
        state.userComments[qid] = [];
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + now.toLocaleDateString('en-GB');

    state.userComments[qid].push({ text, time: timeStr });
    localStorage.setItem('user_comments', JSON.stringify(state.userComments));

    input.value = '';
    
    const listContainer = document.getElementById(`commentsList-${qid}`);
    if (listContainer) {
        listContainer.innerHTML = renderCommentsHtml(qid);
    }

    const countSpan = document.getElementById(`commentCount-${qid}`);
    if (countSpan) {
        countSpan.innerText = `(${getCommentCount(qid)})`;
    }
}

function deleteComment(qid, index) {
    if (state.userComments[qid] && state.userComments[qid][index] !== undefined) {
        state.userComments[qid].splice(index, 1);
        localStorage.setItem('user_comments', JSON.stringify(state.userComments));

        const listContainer = document.getElementById(`commentsList-${qid}`);
        if (listContainer) {
            listContainer.innerHTML = renderCommentsHtml(qid);
        }

        const countSpan = document.getElementById(`commentCount-${qid}`);
        if (countSpan) {
            countSpan.innerText = `(${getCommentCount(qid)})`;
        }
    }
}

function renderCommentsHtml(qid) {
    const comments = state.userComments[qid] || [];

    if (comments.length === 0) {
        return `<div style="font-size:0.82rem; color:var(--text-muted); text-align:center; padding:8px;">${UI_STRINGS.noCommentsYet}</div>`;
    }

    let html = '';
    comments.forEach((c, idx) => {
        html += `
        <div class="comment-item">
            <div class="comment-meta">
                <span><i class="ri-user-3-line"></i> User • ${c.time}</span>
                <button class="comment-delete-btn" onclick="deleteComment('${qid}', ${idx})" title="Delete comment"><i class="ri-delete-bin-line"></i></button>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
        `;
    });
    return html;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// FREEHAND CURSOR PEN & HIGHLIGHTER CANVAS SYSTEM
function toggleExpTool(qid, tool) {
    const currentTool = state.activeTools[qid];
    const newTool = (currentTool === tool) ? null : tool;
    state.activeTools[qid] = newTool;

    const penBtn = document.getElementById(`btnPen-${qid}`);
    const hlBtn = document.getElementById(`btnHL-${qid}`);
    const eraserBtn = document.getElementById(`btnEraser-${qid}`);
    const canvas = document.getElementById(`canvas-${qid}`);

    if (penBtn) penBtn.classList.toggle('active-pen', newTool === 'pen');
    if (hlBtn) hlBtn.classList.toggle('active-hl', newTool === 'highlighter');
    if (eraserBtn) eraserBtn.classList.toggle('active-eraser', newTool === 'eraser');

    if (canvas) {
        canvas.classList.remove('cursor-pen', 'cursor-highlighter', 'cursor-eraser');
        if (newTool) {
            canvas.classList.add('active-canvas', `cursor-${newTool}`);
            initCanvasForQuestion(qid);
        } else {
            canvas.classList.remove('active-canvas');
        }
    }
}

function initAllQuestionCanvases() {
    setTimeout(() => {
        if (!state.questions) return;
        state.questions.forEach(q => {
            initCanvasForQuestion(q.id);
        });
    }, 100);
}

function initCanvasForQuestion(qid) {
    const canvas = document.getElementById(`canvas-${qid}`);
    const box = document.getElementById(`expBox-${qid}`);
    if (!canvas || !box) return;

    const rect = box.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
            canvas.width = Math.floor(rect.width);
            canvas.height = Math.floor(rect.height);

            const savedData = state.canvasDrawingData[qid];
            if (savedData) {
                const img = new Image();
                img.onload = () => {
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                };
                img.src = savedData;
            }
        }
    }

    setupCanvasDrawingEvents(qid, canvas);
}

function setupCanvasDrawingEvents(qid, canvas) {
    if (canvas.dataset.initialized === 'true') return;
    canvas.dataset.initialized = 'true';

    let isDrawing = false;
    let points = [];
    let savedImageData = null;

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    function startDraw(e) {
        const tool = state.activeTools[qid];
        if (!tool) return;

        isDrawing = true;
        const pos = getPos(e);
        points = [pos];

        const ctx = canvas.getContext('2d');
        savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    function draw(e) {
        if (!isDrawing || points.length === 0) return;
        const tool = state.activeTools[qid];
        if (!tool) return;

        if (e.cancelable) e.preventDefault();
        const pos = getPos(e);
        points.push(pos);

        const ctx = canvas.getContext('2d');

        if (tool === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = 28;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(points[points.length - 2].x, points[points.length - 2].y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            return;
        }

        // Restore clean snapshot before stroke for 100% uniform non-dotted spread!
        if (savedImageData) {
            ctx.putImageData(savedImageData, 0, 0);
        }

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (tool === 'pen') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        } else if (tool === 'highlighter') {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.72)';
            ctx.lineWidth = 22;
            ctx.lineCap = 'square';
            ctx.lineJoin = 'miter';
        }

        ctx.stroke();
    }

    function stopDraw() {
        if (isDrawing) {
            isDrawing = false;
            points = [];
            savedImageData = null;
            state.canvasDrawingData[qid] = canvas.toDataURL();
            localStorage.setItem('user_canvas_data', JSON.stringify(state.canvasDrawingData));
        }
    }

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDraw);
}

function clearExpCanvas(qid) {
    const canvas = document.getElementById(`canvas-${qid}`);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    delete state.canvasDrawingData[qid];
    localStorage.setItem('user_canvas_data', JSON.stringify(state.canvasDrawingData));
}

function formatDateObj(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// VISUAL CALENDAR WIDGET MODAL LOGIC
function openDateModal() {
    if (state.date) {
        initCalendarStateFromDate(state.date);
    }
    initCalendarDropdowns();
    renderCalendarGrid();
    document.getElementById('dateModal').classList.add('show');
}

function closeDateModal() {
    document.getElementById('dateModal').classList.remove('show');
}

function initCalendarDropdowns() {
    const monthSel = document.getElementById('calMonthSelect');
    const yearSel = document.getElementById('calYearSelect');
    if (monthSel) monthSel.value = calendarState.month;

    if (yearSel) {
        yearSel.innerHTML = '';
        for (let y = 2026; y >= 2025; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        }
        yearSel.value = calendarState.year;
    }
}

function changeCalendarMonth(delta) {
    calendarState.month += delta;
    if (calendarState.month < 0) {
        calendarState.month = 11;
        calendarState.year--;
    } else if (calendarState.month > 11) {
        calendarState.month = 0;
        calendarState.year++;
    }
    updateCalendarDropdowns();
    renderCalendarGrid();
}

function changeCalendarMonthDirect(monthVal) {
    calendarState.month = parseInt(monthVal);
    renderCalendarGrid();
}

function changeCalendarYearDirect(yearVal) {
    calendarState.year = parseInt(yearVal);
    renderCalendarGrid();
}

function updateCalendarDropdowns() {
    const monthSel = document.getElementById('calMonthSelect');
    const yearSel = document.getElementById('calYearSelect');
    if (monthSel) monthSel.value = calendarState.month;
    if (yearSel) yearSel.value = calendarState.year;
}

function renderCalendarGrid() {
    const daysGrid = document.getElementById('calDaysGrid');
    daysGrid.innerHTML = '';

    const firstDayIndex = new Date(calendarState.year, calendarState.month, 1).getDay();
    const totalDaysInMonth = new Date(calendarState.year, calendarState.month + 1, 0).getDate();

    const todayStr = formatDateObj(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cal-day-cell empty';
        daysGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDaysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'cal-day-cell';

        const monthStr = String(calendarState.month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const cellDateStr = `${calendarState.year}-${monthStr}-${dayStr}`;

        dayCell.innerText = day;

        if (cellDateStr === todayStr) {
            dayCell.classList.add('today');
        }

        if (cellDateStr === state.date) {
            dayCell.classList.add('selected');
        }

        dayCell.onclick = () => {
            state.date = cellDateStr;
            closeDateModal();
            fetchQuestions();
        };

        daysGrid.appendChild(dayCell);
    }
}

// Trigger Sync
async function triggerSync() {
    const syncIcon = document.getElementById('syncIcon');
    if (syncIcon) syncIcon.classList.add('ri-spin');

    try {
        await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: state.date })
        });

        await fetchDates();
        await fetchQuestions();
    } catch (e) {
        console.error('Sync failed:', e);
    } finally {
        if (syncIcon) syncIcon.classList.remove('ri-spin');
    }
}

// Theme Toggle
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);

    const themeIcon = document.getElementById('themeIcon');
    themeIcon.className = (newTheme === 'dark') ? 'ri-sun-line' : 'ri-moon-line';
}

// Disable Right-Click "Save Image As..." Context Menu & Dragging for Images and Canvases
document.addEventListener('contextmenu', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS' || e.target.closest('img') || e.target.closest('canvas')) {
        e.preventDefault();
        return false;
    }
});

document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS' || e.target.closest('img') || e.target.closest('canvas')) {
        e.preventDefault();
        return false;
    }
});
