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
    viewMode: 'daily', // 'daily', 'topic', or 'bookmarks'
    selectedMonth: 'All', // 'All', '2026-09', '2026-08'
    date: null,
    category: 'All',
    availableDates: [],
    questions: [],
    bookmarks: JSON.parse(localStorage.getItem('dailyaffairs_bookmarks') || '{}'), // qid -> question object
    bookmarksCategoryFilter: 'All',
    topicQuestionsLoaded: false,
    user: JSON.parse(localStorage.getItem('dailyaffairs_user') || 'null'),
    userActivity: JSON.parse(localStorage.getItem('dailyaffairs_activity') || '{}'),
    authTab: 'signin',
    authPendingAction: null,
    authPendingQid: null,
    searchQuery: '',
    scrollPreserveCardId: null,
    trackerState: {
        year: new Date().getFullYear(),
        month: new Date().getMonth()
    },
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
        optWrong3: 'oops',
        selectMonthTopicPrompt: 'પ્રશ્નો જોવા માટે કૃપા કરીને ઉપરથી મહિનો અને વિષય બંને પસંદ કરો.',
        selectMonthFirst: 'કૃપા કરીને મહિનો પસંદ કરો',
        selectTopicFirst: 'કૃપા કરીને વિષય / કેટેગરી પસંદ કરો',
        selectMonthLabel: 'મહિનો પસંદ કરો',
        selectTopicLabel: 'વિષય / કેટેગરી પસંદ કરો',
        bookmark: 'બુકમાર્ક',
        bookmarked: 'સેવ કરેલ',
        removeBookmark: 'બુકમાર્ક હટાવો',
        bookmarksTitle: 'બુકમાર્ક કરેલા પ્રશ્નો',
        noBookmarks: 'હજુ સુધી કોઈ પ્રશ્ન બુકમાર્ક કરેલ નથી. પ્રશ્નોને સાચવવા માટે પ્રશ્ન કાર્ડ પર બુકમાર્ક આયકન પર ક્લિક કરો.',
        showQuestions: 'પ્રશ્નો જુઓ'
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
        optWrong3: 'oops',
        selectMonthTopicPrompt: 'प्रश्नों को देखने के लिए कृपया ऊपर से महीना और विषय दोनों चुनें।',
        selectMonthFirst: 'कृपया महीना चुनें',
        selectTopicFirst: 'कृपया विषय / श्रेणी चुनें',
        selectMonthLabel: 'महीना चुनें',
        selectTopicLabel: 'विषय / श्रेणी चुनें',
        bookmark: 'बुकमार्क',
        bookmarked: 'सहेजा गया',
        removeBookmark: 'बुकमार्क हटाएं',
        bookmarksTitle: 'बुकमार्क किए गए प्रश्न',
        noBookmarks: 'अभी तक कोई प्रश्न बुकमार्क नहीं किया गया है। प्रश्नों को सहेजने के लिए प्रश्न कार्ड पर बुकमार्क आइकन पर क्लिक करें।',
        showQuestions: 'प्रश्न देखें'
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
        optWrong3: 'oops',
        selectMonthTopicPrompt: 'Please select both a Month and a Topic above to view questions.',
        selectMonthFirst: 'Please select a Month',
        selectTopicFirst: 'Please select a Topic / Category',
        selectMonthLabel: 'Select Month',
        selectTopicLabel: 'Select Topic / Category',
        bookmark: 'Bookmark',
        bookmarked: 'Saved',
        removeBookmark: 'Remove Bookmark',
        bookmarksTitle: 'Bookmarked Questions',
        noBookmarks: 'No bookmarked questions yet. Click the bookmark icon on any question card to save it here.',
        showQuestions: 'Show Questions'
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

// Update Bookmark Counter Badges (Header & Drawer)
function updateBookmarkBadges() {
    const count = Object.keys(state.bookmarks || {}).length;
    const headerBadge = document.getElementById('headerBookmarkCount');
    const drawerBadge = document.getElementById('drawerBookmarkCount');
    const totalBadge = document.getElementById('bookmarksTotalBadge');

    if (headerBadge) {
        headerBadge.innerText = count;
        headerBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (drawerBadge) {
        drawerBadge.innerText = count;
    }
    if (totalBadge) {
        totalBadge.innerText = `${count} Saved`;
    }
}

// Switch View Mode (Daily vs Topic-Wise vs Bookmarks)
function switchViewMode(mode) {
    state.viewMode = mode;

    const drawerItemDaily = document.getElementById('drawerItemDaily');
    const drawerItemTopic = document.getElementById('drawerItemTopic');
    const drawerItemBookmarks = document.getElementById('drawerItemBookmarks');
    if (drawerItemDaily) drawerItemDaily.classList.toggle('active', mode === 'daily');
    if (drawerItemTopic) drawerItemTopic.classList.toggle('active', mode === 'topic');
    if (drawerItemBookmarks) drawerItemBookmarks.classList.toggle('active', mode === 'bookmarks');

    const topicControlsBar = document.getElementById('topicControlsBar');
    const bookmarksControlsBar = document.getElementById('bookmarksControlsBar');
    const headerDateGroup = document.getElementById('headerDateGroup');
    const dayNavBar = document.getElementById('dayNavBar');
    const dayNavBarTop = document.getElementById('dayNavBarTop');
    const pageTitleIcon = document.getElementById('pageTitleIcon');
    const pageTitleText = document.getElementById('pageTitleText');

    if (mode === 'daily') {
        if (topicControlsBar) topicControlsBar.style.display = 'none';
        if (bookmarksControlsBar) bookmarksControlsBar.style.display = 'none';
        if (headerDateGroup) headerDateGroup.style.display = 'flex';
        if (pageTitleIcon) pageTitleIcon.className = 'ri-flashlight-line';
        if (pageTitleText) pageTitleText.innerText = 'Daily Current Affairs & Analysis';
        state.category = 'All';
        state.selectedMonth = 'All';
        fetchQuestions();
    } else if (mode === 'topic') {
        if (topicControlsBar) topicControlsBar.style.display = 'block';
        if (bookmarksControlsBar) bookmarksControlsBar.style.display = 'none';
        if (headerDateGroup) headerDateGroup.style.display = 'none';
        if (dayNavBar) dayNavBar.style.display = 'none';
        if (dayNavBarTop) dayNavBarTop.style.display = 'none';
        if (pageTitleIcon) pageTitleIcon.className = 'ri-price-tag-3-line';
        if (pageTitleText) pageTitleText.innerText = 'Topic-Wise Current Affairs & Practice';

        // Topic-wise view requires both Month and Topic selection: reset to unselected & gate closed
        state.selectedMonth = '';
        state.category = '';
        state.topicQuestionsLoaded = false;
        const monthSel = document.getElementById('monthSelect');
        const catSel = document.getElementById('categorySelect');
        if (monthSel) monthSel.value = '';
        if (catSel) catSel.value = '';
        fetchQuestions();
    } else if (mode === 'bookmarks') {
        if (topicControlsBar) topicControlsBar.style.display = 'none';
        if (bookmarksControlsBar) bookmarksControlsBar.style.display = 'block';
        if (headerDateGroup) headerDateGroup.style.display = 'none';
        if (dayNavBar) dayNavBar.style.display = 'none';
        if (dayNavBarTop) dayNavBarTop.style.display = 'none';
        if (pageTitleIcon) pageTitleIcon.className = 'ri-bookmark-3-line';
        const titleText = state.lang === 'gu'
            ? 'બુકમાર્ક કરેલા પ્રશ્નો'
            : (state.lang === 'hi' ? 'बुकमार्क किए गए प्रश्न' : 'Bookmarked Questions');
        if (pageTitleText) pageTitleText.innerText = titleText;
        renderBookmarks();
    }
}

// Topic-Wise Explicit Search Trigger
function submitTopicFilter() {
    const monthSel = document.getElementById('monthSelect');
    const catSel = document.getElementById('categorySelect');
    const monthVal = monthSel ? monthSel.value : '';
    const catVal = catSel ? catSel.value : '';

    if (!monthVal || !catVal) {
        renderTopicSelectionPrompt(!monthVal, !catVal);
        return;
    }

    state.selectedMonth = monthVal;
    state.category = catVal;
    state.topicQuestionsLoaded = true;
    fetchQuestions();
}

function filterTopicWise() {
    submitTopicFilter();
}

function filterBookmarksByTopic(category) {
    state.bookmarksCategoryFilter = category || 'All';
    renderBookmarks();
}

// Header Live Current Date, Day & Time (Ticks every second)
function initLiveDateTime() {
    function updateClock() {
        const now = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const dayName = days[now.getDay()];
        const dayNum = String(now.getDate()).padStart(2, '0');
        const monthName = months[now.getMonth()];
        const year = now.getFullYear();

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursPadded = String(hours).padStart(2, '0');

        const liveDay = document.getElementById('liveDayText');
        const liveDate = document.getElementById('liveDateText');
        const liveTime = document.getElementById('liveTimeText');

        if (liveDay) liveDay.innerText = dayName;
        if (liveDate) liveDate.innerText = `${dayNum} ${monthName} ${year}`;
        if (liveTime) liveTime.innerText = `${hoursPadded}:${minutes}:${seconds} ${ampm}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    initLiveDateTime();
    checkLandingPage();
    loadLandingStats();
    updateBookmarkBadges();
    updateUserAuthUI();
    updateStreakBadge();

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

// Scroll Preservation on Language Change
function findActiveViewportQuestionId() {
    const cards = document.querySelectorAll('.ques-card');
    if (!cards || cards.length === 0) return null;
    let closestId = null;
    let minDistance = Infinity;

    cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        // Look for card closest to top below the ~80px sticky header
        const dist = Math.abs(rect.top - 85);
        if (dist < minDistance) {
            minDistance = dist;
            closestId = card.id;
        }
    });
    return closestId;
}

function restoreQuestionScrollPosition() {
    if (!state.scrollPreserveCardId) return;
    const targetId = state.scrollPreserveCardId;
    state.scrollPreserveCardId = null;

    let attempts = 0;
    const tryScroll = () => {
        const el = document.getElementById(targetId);
        if (el) {
            const rect = el.getBoundingClientRect();
            const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetY = currentScrollTop + rect.top - 80;
            window.scrollTo({
                top: Math.max(0, targetY),
                behavior: 'instant'
            });
        } else if (attempts < 6) {
            attempts++;
            setTimeout(tryScroll, 35);
        }
    };
    setTimeout(tryScroll, 25);
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
    state.scrollPreserveCardId = findActiveViewportQuestionId();
    state.lang = newLang;
    localStorage.setItem('user_lang', newLang);
    applyLanguage(newLang);
    fetchQuestions().then(() => {
        restoreQuestionScrollPosition();
    });
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

    const strings = UI_STRINGS_MAP[lang] || UI_STRINGS_MAP['gu'];
    const monthSel = document.getElementById('monthSelect');
    if (monthSel && monthSel.options && monthSel.options[0]) {
        monthSel.options[0].text = `-- ${strings.selectMonthLabel || 'Select Month'} --`;
    }

    const txtShowTopicQ = document.getElementById('txtShowTopicQuestions');
    if (txtShowTopicQ) {
        txtShowTopicQ.innerText = strings.showQuestions || 'Show Questions';
    }

    if (state.viewMode === 'bookmarks') {
        const pageTitleText = document.getElementById('pageTitleText');
        if (pageTitleText) pageTitleText.innerText = strings.bookmarksTitle || 'Bookmarked Questions';
        renderBookmarks();
    }
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

    if (state.viewMode === 'bookmarks') {
        renderBookmarks();
        return;
    }

    // TOPIC-WISE GATE: Do NOT show questions until BOTH month and topic are selected AND Show Questions clicked!
    if (state.viewMode === 'topic') {
        const hasMonth = Boolean(state.selectedMonth && state.selectedMonth !== 'All' && state.selectedMonth !== '');
        const hasTopic = Boolean(state.category && state.category !== 'All' && state.category !== '');

        if (!state.topicQuestionsLoaded || !hasMonth || !hasTopic) {
            state.questions = [];
            renderTopicSelectionPrompt(!hasMonth, !hasTopic);
            fetchCategories();
            return;
        }
    }

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
                restoreQuestionScrollPosition();
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

// Topic-Wise Selection Gate Prompt (No questions shown until both Month and Topic are selected)
function renderTopicSelectionPrompt(missingMonth, missingTopic) {
    const questionsContainer = document.getElementById('questionsList');
    if (!questionsContainer) return;

    const strings = UI_STRINGS_MAP[state.lang] || UI_STRINGS_MAP.gu;
    let hintMsg = strings.selectMonthTopicPrompt;
    if (missingMonth && !missingTopic) {
        hintMsg = strings.selectMonthFirst;
    } else if (!missingMonth && missingTopic) {
        hintMsg = strings.selectTopicFirst;
    }

    const titleText = state.lang === 'gu'
        ? 'મહિનો અને વિષય પસંદ કરો'
        : (state.lang === 'hi' ? 'महीना और विषय चुनें' : 'Select Month & Topic');

    const badgeText = state.lang === 'gu'
        ? 'પ્રશ્નો જોવા માટે મહિનો અને વિષય બંને પસંદ કરવા જરૂરી છે'
        : (state.lang === 'hi'
            ? 'प्रश्न देखने के लिए महीना और विषय दोनों चुनना आवश्यक है'
            : 'Both Month and Topic are required to view questions');

    questionsContainer.innerHTML = `
    <div class="ques-card" style="text-align:center; padding: 50px 24px; max-width: 620px; margin: 35px auto; border-radius: 16px; border: 1.5px dashed var(--border-color); background: var(--bg-card); box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
        <div style="width: 68px; height: 68px; margin: 0 auto 16px; background: rgba(37, 99, 235, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
            <i class="ri-filter-3-line" style="font-size: 2.2rem; color: var(--primary-color);"></i>
        </div>
        <div style="font-size: 1.3rem; font-weight: 700; color: var(--text-dark); margin-bottom: 10px;">
            ${titleText}
        </div>
        <div style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 22px;">
            ${hintMsg}
        </div>
        <div style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--primary-color); background: rgba(37, 99, 235, 0.08); padding: 8px 18px; border-radius: 20px; font-weight: 600;">
            <i class="ri-information-line"></i>
            <span>${badgeText}</span>
        </div>
    </div>
    `;
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

    const strings = UI_STRINGS_MAP[state.lang] || UI_STRINGS_MAP['gu'];
    const placeholder = strings.selectTopicLabel || 'Select Topic / Category';
    let html = `<option value="">-- ${placeholder} --</option>`;

    // Sort categories alphabetically
    const sorted = [...(categories || [])].sort();
    sorted.forEach(cat => {
        const isSel = (state.category && state.category.toLowerCase() === cat.toLowerCase()) ? 'selected' : '';
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
    if (state.viewMode === 'bookmarks') {
        renderBookmarks();
        return;
    }

    const container = document.getElementById('questionsList');
    const langClass = `lang-content-${state.lang}`;

    if (!state.questions || state.questions.length === 0) {
        container.innerHTML = `<div class="ques-card" style="text-align:center; padding:50px; color:var(--text-muted);">${UI_STRINGS.noQuestions}</div>`;
        return;
    }

    let html = '';
    state.questions.forEach((q, idx) => {
        const isRevealed = Boolean(state.revealedAnswers[q.id]);
        const isBookmarked = Boolean(state.bookmarks && state.bookmarks[q.id]);
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
                        <button class="btn-card-bookmark ${isBookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${q.id}', event)" title="${isBookmarked ? (UI_STRINGS.removeBookmark || 'Remove Bookmark') : (UI_STRINGS.bookmark || 'Bookmark Question')}">
                            <i class="${isBookmarked ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line'}"></i>
                        </button>
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

                        <button class="btn-tool btn-bookmark-tool ${isBookmarked ? 'active-bookmark' : ''}" onclick="toggleBookmark('${q.id}')">
                            <i class="${isBookmarked ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line'}"></i>
                            <span id="btnBmkText-${q.id}">${isBookmarked ? (UI_STRINGS.bookmarked || 'Saved') : (UI_STRINGS.bookmark || 'Bookmark')}</span>
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

    recordQuestionAttempt(q);
    renderQuestions();
}

// Toggle Answer & Explanation
function toggleAnswer(qid) {
    state.revealedAnswers[qid] = !Boolean(state.revealedAnswers[qid]);
    renderQuestions();
}

// Toggle Bookmark for a Question
function toggleBookmark(qid, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!state.user) {
        openAuthModal('bookmark', qid);
        return;
    }

    if (!state.bookmarks) state.bookmarks = {};

    if (state.bookmarks[qid]) {
        delete state.bookmarks[qid];
    } else {
        const q = (state.questions || []).find(item => item.id === qid);
        if (q) {
            state.bookmarks[qid] = {
                id: q.id,
                qno: q.qno,
                date: q.date || '',
                category: q.category || 'General',
                question: q.question,
                options: q.options,
                answer: q.answer,
                explanation: q.explanation,
                savedAt: Date.now()
            };
        }
    }

    try {
        localStorage.setItem('dailyaffairs_bookmarks', JSON.stringify(state.bookmarks));
    } catch (e) {
        console.error('Failed to save bookmarks to localStorage', e);
    }

    // Sync bookmarks with cloud account if user is logged in
    if (state.user && state.user.phone) {
        fetch('/api/auth/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: state.user.phone, bookmarks: state.bookmarks })
        }).catch(err => console.error('Cloud bookmark sync error:', err));
    }

    updateBookmarkBadges();

    if (state.viewMode === 'bookmarks') {
        renderBookmarks();
        return;
    }

    // In daily or topic view, update the specific card's bookmark button in place
    const cardEl = document.getElementById(`card-${qid}`);
    if (cardEl) {
        const cardBmkBtn = cardEl.querySelector('.btn-card-bookmark');
        const toolBmkBtn = cardEl.querySelector('.btn-bookmark-tool');
        const toolBmkTxt = document.getElementById(`btnBmkText-${qid}`);
        const isNowBookmarked = Boolean(state.bookmarks[qid]);

        if (cardBmkBtn) {
            cardBmkBtn.classList.toggle('bookmarked', isNowBookmarked);
            cardBmkBtn.innerHTML = `<i class="${isNowBookmarked ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line'}"></i>`;
            cardBmkBtn.title = isNowBookmarked ? (UI_STRINGS.removeBookmark || 'Remove Bookmark') : (UI_STRINGS.bookmark || 'Bookmark Question');
        }

        if (toolBmkBtn) {
            toolBmkBtn.classList.toggle('active-bookmark', isNowBookmarked);
            const icon = toolBmkBtn.querySelector('i');
            if (icon) icon.className = isNowBookmarked ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line';
            if (toolBmkTxt) {
                toolBmkTxt.innerText = isNowBookmarked ? (UI_STRINGS.bookmarked || 'Saved') : (UI_STRINGS.bookmark || 'Bookmark');
            }
        }
    }
}

// Render Bookmarked Questions Organised Topic-Wise
function renderBookmarks() {
    const container = document.getElementById('questionsList');
    if (!container) return;

    const allBookmarks = Object.values(state.bookmarks || {});
    updateBookmarkBadges();

    // Populate the topic filter dropdown in #bookmarksTopicSelect
    const topicSelect = document.getElementById('bookmarksTopicSelect');
    if (topicSelect) {
        const catMap = {};
        allBookmarks.forEach(b => {
            const cat = b.category || 'General';
            catMap[cat] = (catMap[cat] || 0) + 1;
        });

        const currentSelected = state.bookmarksCategoryFilter || 'All';
        let optionsHtml = `<option value="All">-- All Topics (${allBookmarks.length}) --</option>`;
        Object.keys(catMap).sort().forEach(cat => {
            optionsHtml += `<option value="${cat}">${cat} (${catMap[cat]})</option>`;
        });
        topicSelect.innerHTML = optionsHtml;
        topicSelect.value = (Object.keys(catMap).includes(currentSelected) || currentSelected === 'All') ? currentSelected : 'All';
    }

    // If no bookmarks saved at all
    if (allBookmarks.length === 0) {
        const title = state.lang === 'gu'
            ? 'હજુ સુધી કોઈ બુકમાર્ક નથી'
            : (state.lang === 'hi' ? 'अभी तक कोई बुकमार्क नहीं है' : 'No Bookmarked Questions Yet');
        const desc = state.lang === 'gu'
            ? 'મહત્વપૂર્ણ પ્રશ્નોને સેવ કરવા માટે પ્રશ્ન કાર્ડ પર બુકમાર્ક આઇકન પર ક્લિક કરો. અહીં બધા પ્રશ્નો વિષય મુજબ સંગ્રહિત થશે.'
            : (state.lang === 'hi'
                ? 'महत्वपूर्ण प्रश्नों को सहेजने के लिए प्रश्न कार्ड पर बुकमार्क आइकन पर क्लिक करें। यहाँ सभी प्रश्न विषयवार सहेजे जाएंगे।'
                : 'Save important questions while studying by clicking the bookmark icon on any card. They will be neatly organized by topic here.');
        const btnTxt = state.lang === 'gu'
            ? 'આજના પ્રશ્નો જુઓ'
            : (state.lang === 'hi' ? 'आज के प्रश्न देखें' : 'Explore Today\'s MCQs');

        container.innerHTML = `
        <div class="ques-card" style="text-align:center; padding: 60px 24px; max-width: 600px; margin: 40px auto; border-radius: 16px; border: 1.5px dashed var(--border-color); background: var(--bg-card); box-shadow: 0 8px 24px rgba(0,0,0,0.04);">
            <div style="width: 72px; height: 72px; margin: 0 auto 16px; background: rgba(245, 158, 11, 0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="ri-bookmark-3-line" style="font-size: 2.5rem; color: #f59e0b;"></i>
            </div>
            <div style="font-size: 1.35rem; font-weight: 700; color: var(--text-dark); margin-bottom: 10px;">
                ${title}
            </div>
            <div style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 24px;">
                ${desc}
            </div>
            <button class="btn-primary-action btn-show-topic-q" onclick="switchViewMode('daily')">
                <i class="ri-flashlight-line"></i>
                <span>${btnTxt}</span>
            </button>
        </div>
        `;
        return;
    }

    // Filter by topic if selected
    const filterCat = state.bookmarksCategoryFilter || 'All';
    let filteredList = allBookmarks;
    if (filterCat !== 'All') {
        filteredList = allBookmarks.filter(b => (b.category || 'General') === filterCat);
    }

    // Expose filtered list to state.questions for interactive handlers (option clicks, tools)
    state.questions = filteredList;

    if (filteredList.length === 0) {
        container.innerHTML = `
        <div class="ques-card" style="text-align:center; padding: 50px 20px; color: var(--text-muted);">
            No bookmarked questions under "<strong>${filterCat}</strong>".
        </div>
        `;
        return;
    }

    // Group filtered bookmarks by category
    const grouped = {};
    filteredList.forEach(q => {
        const cat = q.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(q);
    });

    const langClass = `lang-content-${state.lang}`;
    let html = '';

    Object.keys(grouped).sort().forEach(catName => {
        const qList = grouped[catName];
        html += `
        <div class="topic-bookmark-group-header">
            <div class="topic-bookmark-group-title">
                <i class="ri-folder-star-line" style="color: #f59e0b; font-size: 1.3rem;"></i>
                <span>${catName}</span>
            </div>
            <span class="topic-bookmark-count-pill">${qList.length} Question${qList.length > 1 ? 's' : ''}</span>
        </div>
        `;

        qList.forEach((q, idx) => {
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
                            <span class="ques-num">Q${idx + 1}.</span>
                            <span class="category-tag">${q.category || 'General'}</span>
                            ${q.date ? `<span class="category-tag" style="background: rgba(107, 114, 128, 0.1); color: var(--text-muted);"><i class="ri-calendar-line"></i> ${formatDisplayDate(q.date)}</span>` : ''}
                            <button class="btn-card-bookmark bookmarked" onclick="toggleBookmark('${q.id}', event)" title="${UI_STRINGS.removeBookmark || 'Remove Bookmark'}">
                                <i class="ri-bookmark-3-fill"></i>
                            </button>
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

                            <button class="btn-tool btn-bookmark-tool active-bookmark" onclick="toggleBookmark('${q.id}')">
                                <i class="ri-bookmark-3-fill"></i>
                                <span id="btnBmkText-${q.id}">${UI_STRINGS.bookmarked || 'Saved'}</span>
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

                    <!-- RIGHT COLUMN: EXPLANATION & ANALYSIS -->
                    <div class="ques-right-col">
                        <div class="explanation-box ${isRevealed ? 'show' : ''}" id="expBox-${q.id}">
                            <canvas class="exp-drawing-canvas ${activeTool ? 'active-canvas cursor-' + activeTool : ''}" id="canvas-${q.id}"></canvas>

                            <div class="exp-header-row" style="position:relative; z-index:10; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:10px;">
                                <div class="ans-badge" style="margin-bottom:0;">${UI_STRINGS.answerPrefix} Option ${q.answer}</div>
                                
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
    });

    container.innerHTML = html;
    initAllQuestionCanvases();
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
        // Server-side filters keep mobile downloads small (month ~300 Q instead of 6600+)
        let fetchUrl = `/api/current-affairs?lang=${lang}`;
        const monthVal = (exportType === 'month') ? (document.getElementById('pdfSelectMonth')?.value || 'All') : 'All';
        if (monthVal !== 'All') {
            fetchUrl += `&month=${monthVal}`;
        } else {
            fetchUrl += '&date=all';
        }
        if (selectedCategory !== 'All') {
            fetchUrl += `&category=${encodeURIComponent(selectedCategory)}`;
        }
        const response = await fetch(fetchUrl);
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

    let printWindow = null;
    try {
        printWindow = window.open('', '_blank');
    } catch (e) {
        printWindow = null;
    }
    if (!printWindow) {
        // Popup blocked (common on mobile) — download printable HTML file instead
        try {
            const blob = new Blob([pdfHtml], { type: 'text/html;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `DailyAffairs-${Date.now()}.html`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
            alert('Pop-up blocked, so the printable file was downloaded. Open it and use Print / Save as PDF.');
        } catch (e2) {
            alert('Pop-up blocker prevented opening the printable window. Please allow pop-ups for this site.');
        }
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

    try {
        printWindow.document.write(pdfHtml);
        printWindow.document.close();
    } catch (e) {
        // Some mobile browsers block cross-window document.write — fall back to download
        try { printWindow.close(); } catch (e2) {}
        const blob = new Blob([pdfHtml], { type: 'text/html;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `DailyAffairs-${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
        alert('Direct print was blocked, so the printable file was downloaded. Open it and use Print / Save as PDF.');
    }
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

// ==========================================
// 1. BOOKMARK MENU AUTH GATE
// ==========================================
function handleBookmarkMenuClick() {
    closeMenuDrawer();
    if (!state.user) {
        openAuthModal('view_bookmarks');
        return;
    }
    switchViewMode('bookmarks');
}

// ==========================================
// 2. DAILY TARGET & ACTIVITY TRACKER
// ==========================================
function recordQuestionAttempt(q) {
    if (!q) return;
    const targetDate = q.date || state.date || new Date().toISOString().split('T')[0];
    if (!targetDate) return;

    if (!state.userActivity) state.userActivity = {};
    if (!state.userActivity[targetDate]) {
        state.userActivity[targetDate] = {
            totalQuestions: 0,
            attemptedQids: [],
            status: 'half'
        };
    }

    const dayAct = state.userActivity[targetDate];
    if (!dayAct.attemptedQids) dayAct.attemptedQids = [];
    if (!dayAct.attemptedQids.includes(q.id)) {
        dayAct.attemptedQids.push(q.id);
    }

    const availableCount = (state.questions && state.questions.length > 0) ? state.questions.length : 10;
    dayAct.totalQuestions = Math.max(dayAct.totalQuestions || 0, availableCount);

    if (dayAct.attemptedQids.length >= dayAct.totalQuestions) {
        dayAct.status = 'completed';
    } else {
        dayAct.status = 'half';
    }

    try {
        localStorage.setItem('dailyaffairs_activity', JSON.stringify(state.userActivity));
    } catch (e) {}

    updateStreakBadge();

    // Sync activity with cloud backend if logged in
    if (state.user && state.user.phone) {
        fetch('/api/auth/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: state.user.phone,
                date: targetDate,
                status: dayAct.status,
                count: dayAct.attemptedQids.length
            })
        }).catch(err => console.error('Cloud activity sync error:', err));
    }
}

function calculateCurrentStreak() {
    if (!state.userActivity) return 0;
    let streak = 0;
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayAct = state.userActivity[todayStr];

    if (todayAct && (todayAct.status === 'completed' || todayAct.status === 'half')) {
        streak++;
    }

    for (let i = 1; i <= 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const act = state.userActivity[dStr];
        if (act && (act.status === 'completed' || act.status === 'half')) {
            streak++;
        } else {
            break;
        }
    }
    return streak;
}

function updateStreakBadge() {
    const streak = calculateCurrentStreak();
    const drawerBadge = document.getElementById('drawerStreakBadge');
    if (drawerBadge) {
        drawerBadge.innerText = `${streak}🔥`;
    }
}

function handleTargetTrackerClick() {
    closeMenuDrawer();
    if (!state.user) {
        openAuthModal('tracker');
        return;
    }
    openTargetTrackerModal();
}

function openTargetTrackerModal() {
    const modal = document.getElementById('targetTrackerModal');
    if (!modal) return;
    renderTrackerCalendar();
    modal.classList.add('show');
}

function closeTargetTrackerModal() {
    const modal = document.getElementById('targetTrackerModal');
    if (modal) modal.classList.remove('show');
}

function changeTrackerMonth(delta) {
    state.trackerState.month += delta;
    if (state.trackerState.month < 0) {
        state.trackerState.month = 11;
        state.trackerState.year -= 1;
    } else if (state.trackerState.month > 11) {
        state.trackerState.month = 0;
        state.trackerState.year += 1;
    }
    renderTrackerCalendar();
}

function renderTrackerCalendar() {
    const daysGrid = document.getElementById('trackerDaysGrid');
    const titleEl = document.getElementById('trackerMonthTitle');
    if (!daysGrid) return;

    const streakVal = document.getElementById('trackerStreakVal');
    const completedVal = document.getElementById('trackerCompletedVal');
    const halfVal = document.getElementById('trackerHalfVal');
    const missedVal = document.getElementById('trackerMissedVal');

    const year = state.trackerState.year;
    const month = state.trackerState.month;
    if (titleEl) {
        titleEl.innerText = `${MONTH_NAMES[month]} ${year}`;
    }

    let fullCount = 0;
    let halfCount = 0;
    let missedCount = 0;

    const todayObj = new Date();
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;

    daysGrid.innerHTML = '';
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'target-day-cell empty';
        daysGrid.appendChild(emptyCell);
    }

    for (let d = 1; d <= totalDays; d++) {
        const dStr = String(d).padStart(2, '0');
        const mStr = String(month + 1).padStart(2, '0');
        const dateStr = `${year}-${mStr}-${dStr}`;

        const cell = document.createElement('div');
        cell.className = 'target-day-cell';

        const dayNumSpan = document.createElement('span');
        dayNumSpan.className = 'day-num';
        dayNumSpan.innerText = d;
        cell.appendChild(dayNumSpan);

        const isAvailable = state.availableDates && state.availableDates.includes(dateStr);
        const act = state.userActivity ? state.userActivity[dateStr] : null;

        if (dateStr === todayStr) {
            cell.classList.add('today');
        }

        if (act && act.status === 'completed') {
            cell.classList.add('status-completed');
            cell.title = `Full Target Solved (${act.attemptedQids ? act.attemptedQids.length : 0} questions)`;
            fullCount++;
        } else if (act && act.status === 'half') {
            cell.classList.add('status-half');
            cell.title = `Partially Solved (${act.attemptedQids ? act.attemptedQids.length : 0} questions)`;
            halfCount++;
        } else if (isAvailable && dateStr < todayStr) {
            cell.classList.add('status-missed');
            cell.title = 'Missed: No questions attempted';
            missedCount++;
        }

        if (isAvailable) {
            cell.classList.add('has-questions');
            cell.onclick = () => {
                state.date = dateStr;
                closeTargetTrackerModal();
                switchViewMode('daily');
                fetchQuestions();
            };
        } else {
            cell.classList.add('no-questions');
        }

        daysGrid.appendChild(cell);
    }

    if (streakVal) streakVal.innerText = calculateCurrentStreak();
    if (completedVal) completedVal.innerText = fullCount;
    if (halfVal) halfVal.innerText = halfCount;
    if (missedVal) missedVal.innerText = missedCount;
}

// ==========================================
// 3. AUTH MODAL & CONTROLLERS
// ==========================================
function openAuthModal(pendingAction = null, pendingQid = null) {
    state.authPendingAction = pendingAction;
    state.authPendingQid = pendingQid;
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('show');
    switchAuthTab(state.authTab || 'signin');
    const errBox = document.getElementById('authErrorBox');
    if (errBox) errBox.style.display = 'none';
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('show');
    state.authPendingAction = null;
    state.authPendingQid = null;
}

function switchAuthTab(tab) {
    state.authTab = tab;
    const tabSignIn = document.getElementById('tabBtnSignIn');
    const tabSignUp = document.getElementById('tabBtnSignUp');
    const submitBtnTxt = document.getElementById('btnAuthSubmitText');
    const subDesc = document.getElementById('authSubDesc');
    const promptText = document.getElementById('authSwitchPrompt');
    const switchLink = document.getElementById('authSwitchLink');
    const errBox = document.getElementById('authErrorBox');
    if (errBox) errBox.style.display = 'none';

    if (tab === 'signup') {
        if (tabSignIn) tabSignIn.classList.remove('active');
        if (tabSignUp) tabSignUp.classList.add('active');
        if (submitBtnTxt) submitBtnTxt.innerText = 'Sign Up';
        if (subDesc) subDesc.innerText = 'Create a free account with your mobile number to track daily targets & save bookmarks.';
        if (promptText) promptText.innerText = 'Already have an account?';
        if (switchLink) switchLink.innerText = 'Sign In';
    } else {
        if (tabSignIn) tabSignIn.classList.add('active');
        if (tabSignUp) tabSignUp.classList.remove('active');
        if (submitBtnTxt) submitBtnTxt.innerText = 'Sign In';
        if (subDesc) subDesc.innerText = 'Sign in with your mobile number to unlock Bookmarks & Daily Target Tracker.';
        if (promptText) promptText.innerText = "Don't have an account?";
        if (switchLink) switchLink.innerText = 'Sign Up';
    }
}

function toggleAuthTab() {
    switchAuthTab(state.authTab === 'signin' ? 'signup' : 'signin');
}

function togglePasswordVisibility(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPwd = input.type === 'password';
    input.type = isPwd ? 'text' : 'password';
    const icon = btnEl ? btnEl.querySelector('i') : null;
    if (icon) {
        icon.className = isPwd ? 'ri-eye-off-line' : 'ri-eye-line';
    }
}

function handleAuthClick() {
    closeMenuDrawer();
    if (state.user) {
        const shouldLogout = confirm(`Signed in as +91 ${state.user.phone}\n\nDo you want to log out? / તમે લોગ આઉટ કરવા માંગો છો?`);
        if (shouldLogout) {
            logoutUser();
        }
    } else {
        openAuthModal();
    }
}

function logoutUser() {
    state.user = null;
    localStorage.removeItem('dailyaffairs_user');
    updateUserAuthUI();
    if (state.viewMode === 'bookmarks') {
        switchViewMode('daily');
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('authPhone');
    const pwdInput = document.getElementById('authPassword');
    const errBox = document.getElementById('authErrorBox');
    const btnSubmit = document.getElementById('btnAuthSubmit');

    const phone = (phoneInput ? phoneInput.value : '').trim();
    const password = (pwdInput ? pwdInput.value : '').trim();

    // Validate 10 digit Indian mobile number starting with 6, 7, 8, 9
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        if (errBox) {
            errBox.innerText = 'કૃપા કરીને માન્ય 10-અંકનો મોબાઇલ નંબર દાખલ કરો (6, 7, 8, 9 થી શરૂ થતો). / Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.';
            errBox.style.display = 'block';
        }
        return;
    }

    if (!password || password.length < 4) {
        if (errBox) {
            errBox.innerText = 'પાસવર્ડ ઓછામાં ઓછો 4 અક્ષરોનો હોવો જોઈએ. / Password must be at least 4 characters long.';
            errBox.style.display = 'block';
        }
        return;
    }

    if (errBox) errBox.style.display = 'none';
    if (btnSubmit) btnSubmit.disabled = true;

    const endpoint = state.authTab === 'signup' ? '/api/auth/register' : '/api/auth/login';

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, password })
        });
        const data = await res.json();

        if (data.status === 'success') {
            state.user = data.user;
            localStorage.setItem('dailyaffairs_user', JSON.stringify(data.user));

            // Merge cloud bookmarks & activity
            if (data.user.bookmarks) {
                state.bookmarks = { ...state.bookmarks, ...data.user.bookmarks };
                localStorage.setItem('dailyaffairs_bookmarks', JSON.stringify(state.bookmarks));
            }
            if (data.user.activity) {
                state.userActivity = { ...state.userActivity, ...data.userActivity };
                localStorage.setItem('dailyaffairs_activity', JSON.stringify(state.userActivity));
            }

            updateUserAuthUI();
            updateBookmarkBadges();
            updateStreakBadge();

            const pendingAction = state.authPendingAction;
            const pendingQid = state.authPendingQid;
            closeAuthModal();

            if (pendingAction === 'bookmark' && pendingQid) {
                toggleBookmark(pendingQid);
            } else if (pendingAction === 'view_bookmarks') {
                switchViewMode('bookmarks');
            } else if (pendingAction === 'tracker') {
                openTargetTrackerModal();
            }
        } else {
            if (errBox) {
                errBox.innerText = data.message || 'Authentication failed. Please check credentials.';
                errBox.style.display = 'block';
            }
        }
    } catch (err) {
        console.error('Auth request failed:', err);
        if (errBox) {
            errBox.innerText = 'Server connection error. Please try again.';
            errBox.style.display = 'block';
        }
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

function updateUserAuthUI() {
    const headerAuthIcon = document.getElementById('headerAuthIcon');
    const drawerUserName = document.getElementById('drawerUserName');
    const drawerUserStatus = document.getElementById('drawerUserStatus');
    const drawerAuthBtn = document.getElementById('drawerAuthBtn');

    if (state.user) {
        if (headerAuthIcon) {
            headerAuthIcon.className = 'ri-user-fill';
            headerAuthIcon.style.color = '#10b981';
        }
        if (drawerUserName) {
            drawerUserName.innerText = `+91 ${state.user.phone}`;
        }
        if (drawerUserStatus) {
            drawerUserStatus.innerText = 'Active Member • Tap to Log Out';
        }
        if (drawerAuthBtn) {
            drawerAuthBtn.innerHTML = '<i class="ri-logout-box-r-line"></i>';
            drawerAuthBtn.title = 'Log Out';
        }
    } else {
        if (headerAuthIcon) {
            headerAuthIcon.className = 'ri-user-3-line';
            headerAuthIcon.style.color = '';
        }
        if (drawerUserName) {
            drawerUserName.innerText = 'Guest User';
        }
        if (drawerUserStatus) {
            drawerUserStatus.innerText = 'Tap to Sign In / Sign Up';
        }
        if (drawerAuthBtn) {
            drawerAuthBtn.innerHTML = '<i class="ri-login-box-line"></i>';
            drawerAuthBtn.title = 'Sign In';
        }
    }
}

// ==========================================
// 4. MENU-ONLY KEYWORD SEARCH
// ==========================================
let searchDebounceTimeout = null;
function handleMenuSearch(query) {
    const clearBtn = document.getElementById('btnMenuSearchClear');
    if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';

    state.searchQuery = (query || '').trim();

    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        applyMenuSearchFilter();
    }, 200);
}

function clearMenuSearch() {
    const input = document.getElementById('menuSearchInput');
    const clearBtn = document.getElementById('btnMenuSearchClear');
    if (input) input.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    state.searchQuery = '';
    applyMenuSearchFilter();
}

function applyMenuSearchFilter() {
    const banner = document.getElementById('searchResultsBanner');
    const query = (state.searchQuery || '').toLowerCase();

    if (!query) {
        if (banner) banner.style.display = 'none';
        renderQuestions();
        return;
    }

    if (banner) {
        banner.style.display = 'flex';
        const txt = document.getElementById('searchBannerText');
        if (txt) txt.innerText = `Search results for "${state.searchQuery}"`;
    }

    const container = document.getElementById('questionsList');
    if (!container) return;

    // Filter questions by keyword matching across question, explanation, category, and options
    const matches = (state.questions || []).filter(q => {
        const inQ = (q.question || '').toLowerCase().includes(query);
        const inExp = (q.explanation || '').toLowerCase().includes(query);
        const inCat = (q.category || '').toLowerCase().includes(query);
        const inOpts = q.options && (
            (q.options.A || '').toLowerCase().includes(query) ||
            (q.options.B || '').toLowerCase().includes(query) ||
            (q.options.C || '').toLowerCase().includes(query) ||
            (q.options.D || '').toLowerCase().includes(query)
        );
        return inQ || inExp || inCat || inOpts;
    });

    if (matches.length === 0) {
        container.innerHTML = `<div class="ques-card" style="text-align:center; padding:50px; color:var(--text-muted);">No questions found matching "${state.searchQuery}".</div>`;
        return;
    }

    const savedQuestions = state.questions;
    state.questions = matches;
    renderQuestions();
    state.questions = savedQuestions;
}
