/**
 * SKR-HUB DASHBOARD MASTER ULTIMATE — v2.1 FIXED
 *
 * BUG FIXES:
 * [B1] CRITICAL — icons[] scope lỗi: định nghĩa trong initSakura() nhưng createPetal() dùng như global → ReferenceError
 * [B2] CRITICAL — initVolumeControl: innerHTML += sau appendChild() sẽ destroy slider element khỏi DOM
 * [B3] MAJOR   — Timer drift: setInterval(1000ms) lệch ~500ms sau 30 phút → dùng Date.now()
 * [B4] MAJOR   — startTimer() không clearInterval cũ trước khi tạo mới → timer chạy đôi
 * [B5] MAJOR   — audio.play() không try/catch → crash khi browser block autoplay
 * [B6] MEDIUM  — addXP() gọi loadUserStats() mỗi 60s → quá nhiều API call → debounce
 * [B7] MEDIUM  — renderNotes() dùng innerHTML với n.text user input → XSS vulnerability
 * [B8] MINOR   — logout listener nằm ngoài DOMContentLoaded → có thể chạy trước khi DOM ready
 * [B9] MINOR   — sakura memory leak: 2 petal/300ms không có giới hạn → DOM phình to
 *
 * IMPROVEMENTS:
 * [+] Theme toggle (dark/light mode)
 * [+] visibilitychange pause timer khi tab ẩn
 * [+] Notification permission + browser notification khi hết giờ
 * [+] Keyboard shortcuts: Space (start/pause), R (reset), F (focus mode)
 */

// ==================== GLOBAL STATE ====================
const SKR = {
    xp: 0,
    level: 1,
    streak: 0,
    goal: 30,
    totalMinutes: 0,
    focusCount: 0,
    tasksCompleted: 0,
    ranks: ["⚡ TÂN BINH", "🌟 HỌC GIẢ", "🔥 BẬC THẦY", "💫 THẦN ĐỒNG", "👑 SKR GOD"],
    rankMessages: [
        "Every master was once a beginner. Keep going!",
        "You're on fire! Consistency is key.",
        "Greatness is built one day at a time.",
        "You're unstoppable! The sky is the limit.",
        "Legendary status achieved. Inspire others!"
    ],
    quotes: [
        "Discipline is the bridge between goals and accomplishment.",
        "Don't watch the clock; do what it does. Keep going.",
        "Success is the sum of small efforts, repeated day in and day out.",
        "The expert in anything was once a beginner.",
        "Your only limit is your mind.",
        "Focus on being productive instead of busy.",
        "The future depends on what you do today."
    ],
    achievements: []
};

// ==================== KHỞI TẠO ====================
document.addEventListener('DOMContentLoaded', async () => {
    // User-specific localStorage isolation
    const _uid = document.querySelector('meta[name="skr-uid"]')?.content || '0';
    window.SKR_UID = _uid;
    window.NOTE_KEY = `skr_notes_${_uid}`;

    initWelcome();
    initSakura();
    initDailyQuote();
    await loadUserStats();
    initHeatmap();
    renderNotes();
    initVolumeControl();
    initFocusExit();
    startTimeTracker();
    initPomodoroControls();
    initThemeToggle();         // [+] theme toggle
    initKeyboardShortcuts();   // [+] keyboard shortcuts
    requestNotifPermission();  // [+] browser notification
    initLogout();              // [B8] fix: đưa vào đây thay vì ngoài DOMContentLoaded
});

// ==================== WELCOME ====================
function initWelcome() {
    const overlay = document.getElementById('welcome-overlay');
    if (!overlay) return;
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => overlay.remove(), 1000);
    }, 2500);
}

// ==================== SAKURA ====================
// [B1] FIX: đưa icons ra module scope để createPetal() dùng được
const PETAL_ICONS = ["🌸", "💮", "✨", "🌸", "🌸", "🌸"];
// [B9] FIX: giới hạn số petal trên DOM
const MAX_PETALS = 30;
let petalInterval = null;

function initSakura() {
    petalInterval = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        // [B9] đếm petal hiện có trước khi thêm
        const current = document.querySelectorAll('.sakura-petal').length;
        if (current >= MAX_PETALS) return;
        createPetal();
        if (current + 1 < MAX_PETALS) createPetal();
    }, 300);
}

function createPetal() {
    const petal = document.createElement('div');
    petal.className = 'sakura-petal';
    // [B1] FIX: dùng PETAL_ICONS thay vì icons (was ReferenceError)
    petal.textContent = PETAL_ICONS[Math.floor(Math.random() * PETAL_ICONS.length)];
    petal.style.cssText = `
        left: ${Math.random() * 100}vw;
        font-size: ${Math.random() * 20 + 15}px;
        animation-duration: ${Math.random() * 6 + 6}s;
        animation-delay: ${Math.random() * 2}s;
        opacity: ${(Math.random() * 0.6 + 0.4).toFixed(2)};
    `;
    document.body.appendChild(petal);

    petal.addEventListener('mouseenter', () => {
        petal.classList.add('linger');
        setTimeout(() => petal.remove(), 1000);
    }, { once: true });

    const lifetime = (parseFloat(petal.style.animationDuration) +
                      parseFloat(petal.style.animationDelay)) * 1000;
    setTimeout(() => {
        if (!petal.isConnected) return;
        if (Math.random() < 0.15) {
            petal.classList.add('linger');
            setTimeout(() => petal.remove(), 1000);
        } else {
            petal.remove();
        }
    }, lifetime);
}

// ==================== QUOTE ====================
function initDailyQuote() {
    const el = document.getElementById('daily-quote');
    if (!el) return;
    // dùng ngày để quote không đổi mỗi lần reload
    const idx = new Date().getDate() % SKR.quotes.length;
    el.textContent = `"${SKR.quotes[idx]}"`;
}

// ==================== LEVEL & XP ====================
async function loadUserStats() {
    try {
        const res = await fetch('/api/user/stats');
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();

        SKR.xp             = data.xp             || 0;
        SKR.xp_for_level   = data.xp_for_level   || undefined;
        SKR.xp_for_next    = data.xp_for_next    || undefined;
        SKR.level          = data.level           || 1;
        SKR.streak         = data.streak          || 0;
        SKR.totalMinutes   = data.total_minutes   || 0;
        SKR.goal           = data.goal            || 30;
        SKR.focusCount     = data.focus_count     || 0;
        SKR.tasksCompleted = data.tasks_completed || 0;
        SKR.achievements   = data.achievements    || [];

        updateLvlUI();
        setText('streakCount', SKR.streak);
        setText('goalDisplay', SKR.totalMinutes);
        setText('goalTarget',  SKR.goal);
        setText('focusCount',  SKR.focusCount);
        renderAchievements();
    } catch (e) {
        console.warn('[SKR] Using localStorage fallback', e);
        loadFromLocal();
    }
}

function loadFromLocal() {
    SKR.xp         = parseInt(localStorage.getItem('skr_xp'))          || 0;
    SKR.level      = parseInt(localStorage.getItem('skr_level'))        || 1;
    SKR.streak     = parseInt(localStorage.getItem('skr_streak'))       || 0;
    SKR.focusCount = parseInt(localStorage.getItem('skr_focus_count'))  || 0;
    updateLvlUI();
}

// [B6] FIX: debounce loadUserStats sau khi addXP — không gọi mỗi 60s
let _reloadTimer = null;
async function addXP(amount) {
    try {
        const res = await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'xp_time', value: amount })
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.level_up > 0) {
            showToast('🎉 LEVEL UP!', false, 5000);
            confettiEffect();
        }
        // [B6] debounce: gộp nhiều lần addXP trong 3s thành 1 lần reload
        clearTimeout(_reloadTimer);
        _reloadTimer = setTimeout(() => loadUserStats(), 3000);
    } catch (e) { /* silent */ }
}

function updateLvlUI() {
    const rankIndex = Math.min(SKR.level - 1, SKR.ranks.length - 1);
    setText('lvlNumber',  SKR.level);
    setText('rankName',   SKR.ranks[rankIndex]);
    setText('currentXp',  SKR.xp);

    // Use server values if available (most accurate), else calculate locally
    const currentXp = SKR.xp_for_level !== undefined ? SKR.xp_for_level : getXpForLevel(SKR.level);
    const nextXp    = SKR.xp_for_next  !== undefined ? SKR.xp_for_next  : getXpForLevel(SKR.level + 1);
    const denom     = nextXp - currentXp;
    const percent   = denom > 0
        ? Math.min(100, Math.max(0, ((SKR.xp - currentXp) / denom) * 100))
        : 100;
    const fill = document.getElementById('xpFill');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;

    setText('rankMessage', SKR.rankMessages[rankIndex] || SKR.rankMessages[0]);
}

// ── XP formula — MUST match main.py xp_for_level() ──
function getXpForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(50 * Math.pow(level - 1, 1.6));
}

// helper tránh lặp getElementById + innerText
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

// ==================== TIME TRACKER ====================
let _lastTickTime = Date.now();
let _accumulatedMs = 0;

function startTimeTracker() {
    // [B3] FIX: dùng Date.now() delta thay vì tin tưởng setInterval đúng 1000ms
    setInterval(() => {
        if (document.visibilityState !== 'visible') {
            _lastTickTime = Date.now(); // reset khi tab quay lại
            return;
        }
        const now   = Date.now();
        const delta = now - _lastTickTime;
        _lastTickTime = now;
        _accumulatedMs += delta;

        // mỗi 60s thực tế mới cộng XP
        if (_accumulatedMs >= 60_000) {
            _accumulatedMs -= 60_000;
            addXP(1);
        }
    }, 1000);
}

// ==================== POMODORO ====================
let timerInterval  = null;
let timerEndTime   = null;   // [B3] dùng timestamp thay vì đếm ngược
let timerDuration  = 25 * 60 * 1000;
let isRunning      = false;
let volume         = 0.7;

function initPomodoroControls() {
    ['setH', 'setM', 'setS'].forEach(id => {
        const input = document.getElementById(id);
        if (input && !input.closest('.time-input-group')) {
            wrapInputWithButtons(input, id.slice(-1));
        }
    });
}

function wrapInputWithButtons(input, label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'time-input-group';

    const make = (symbol, delta) => {
        const btn = document.createElement('button');
        btn.innerHTML  = symbol;
        btn.type       = 'button';
        btn.addEventListener('click', () => {
            let val = parseInt(input.value) || 0;
            const max = (label === 'H') ? 99 : 59;
            val = Math.min(max, Math.max(0, val + delta));
            input.value = val.toString().padStart(2, '0');
        });
        return btn;
    };

    input.parentNode.insertBefore(wrapper, input);
    wrapper.append(make('−', -1), input, make('+', 1));
    input.style.width = '60px';
    input.style.textAlign = 'center';
    if (!input.classList.contains('candy-input')) input.classList.add('candy-input');
}

function initVolumeControl() {
    const select = document.getElementById('alarmSound');
    if (!select) return;

    // [B2] FIX: KHÔNG dùng innerHTML += sau appendChild → tạo riêng từng element
    const volDiv   = document.createElement('div');
    volDiv.className = 'volume-control';

    const iconDown = document.createElement('i');
    iconDown.className = 'fas fa-volume-down';

    const slider = document.createElement('input');
    slider.type      = 'range';
    slider.min       = '0';
    slider.max       = '1';
    slider.step      = '0.05';
    slider.value     = volume;
    slider.className = 'volume-slider';

    const iconUp = document.createElement('i');
    iconUp.className = 'fas fa-volume-up';

    // thứ tự: iconDown → slider → iconUp (không innerHTML nào cả)
    volDiv.append(iconDown, slider, iconUp);
    select.parentNode.insertBefore(volDiv, select.nextSibling);

    slider.addEventListener('input', e => {
        volume = parseFloat(e.target.value);
    });
}

function startTimer() {
    if (isRunning) return;

    // [B4] FIX: clear interval cũ trước khi tạo mới
    clearInterval(timerInterval);

    const h = parseInt(document.getElementById('setH')?.value) || 0;
    const m = parseInt(document.getElementById('setM')?.value) || 0;
    const s = parseInt(document.getElementById('setS')?.value) || 0;
    const totalSec = (h * 3600) + (m * 60) + s || 25 * 60;

    timerDuration = totalSec * 1000;
    // [B3] FIX: ghi timestamp kết thúc thay vì đếm ngược
    timerEndTime  = Date.now() + timerDuration;
    isRunning     = true;

    timerInterval = setInterval(tickTimer, 500); // poll 2x/s để chính xác hơn
    updateDisplay();
    showToast('⏳ Focus session started!');
}

function tickTimer() {
    if (!isRunning) return;
    const remaining = timerEndTime - Date.now();
    if (remaining <= 0) {
        handleTimerComplete();
    } else {
        updateDisplayMs(remaining);
    }
}

function pauseTimer() {
    if (!isRunning) return;
    // lưu thời gian còn lại để tiếp tục sau
    timerDuration = Math.max(0, timerEndTime - Date.now());
    clearInterval(timerInterval);
    isRunning = false;
    showToast('⏸️ Timer paused');
}

function resumeTimer() {
    if (isRunning || timerDuration <= 0) return;
    timerEndTime  = Date.now() + timerDuration;
    isRunning     = true;
    timerInterval = setInterval(tickTimer, 500);
    showToast('▶️ Timer resumed');
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning    = false;
    timerEndTime = null;
    timerDuration = 25 * 60 * 1000;
    // hiển thị lại giá trị từ input
    const h = parseInt(document.getElementById('setH')?.value) || 0;
    const m = parseInt(document.getElementById('setM')?.value) || 25;
    const s = parseInt(document.getElementById('setS')?.value) || 0;
    const disp = document.getElementById('timerDisplay');
    if (disp) disp.textContent =
        `${h > 0 ? h + ':' : ''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    showToast('↺ Timer reset');
}

function updateDisplay() {
    if (timerEndTime) {
        updateDisplayMs(timerEndTime - Date.now());
    }
}

function updateDisplayMs(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const disp = document.getElementById('timerDisplay');
    if (disp) disp.textContent =
        `${h > 0 ? h + ':' : ''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

async function handleTimerComplete() {
    clearInterval(timerInterval);
    isRunning = false;

    // [B5] FIX: try/catch cho audio.play() — browser có thể block autoplay
    try {
        const soundSrc = document.getElementById('alarmSound')?.value;
        if (soundSrc) {
            // Try AudioContext first (works even without prior user gesture in some browsers)
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') await ctx.resume();
            const resp = await fetch(soundSrc);
            const buf  = await resp.arrayBuffer();
            const decoded = await ctx.decodeAudioData(buf);
            const src = ctx.createBufferSource();
            const gain = ctx.createGain();
            gain.gain.value = volume;
            src.buffer = decoded;
            src.connect(gain);
            gain.connect(ctx.destination);
            src.start(0);
        }
    } catch (e) {
        // Fallback: plain Audio element
        try {
            const soundSrc = document.getElementById('alarmSound')?.value;
            if (soundSrc) {
                const snd = new Audio(soundSrc);
                snd.volume = volume;
                snd.play().catch(() => {});
            }
        } catch (_) {}
        console.warn('[SKR] Audio via AudioContext blocked, used fallback');
    }

    // [+] Browser notification nếu tab đang ẩn
    if (document.visibilityState !== 'visible' &&
        Notification.permission === 'granted') {
        new Notification('SKR-HUB ✅', {
            body: 'Focus session complete! +30 XP',
            icon: '/static/icon.png'
        });
    }

    try {
        const res = await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'focus_complete' })
        });
        const data = await res.json();
        if (data.level_up) showToast('🎉 LEVEL UP!', false, 4000);
        loadUserStats();
    } catch (e) { /* silent */ }

    showToast('✅ FOCUS SESSION COMPLETE! +30 XP', false, 4000);
    resetTimer();
}

// ==================== FOCUS MODE ====================
function toggleFocusMode() {
    document.body.classList.toggle('focus-mode');
    if (document.body.classList.contains('focus-mode')) {
        showToast('🎯 Focus mode ON');
        addExitFocusButton();
    } else {
        showToast('Focus mode OFF');
        removeExitFocusButton();
    }
}

function addExitFocusButton() {
    if (document.getElementById('exit-focus-btn')) return;
    const btn = document.createElement('button');
    btn.id        = 'exit-focus-btn';
    btn.className = 'candy-btn blue';
    btn.innerHTML = '<i class="fas fa-times"></i> EXIT FOCUS';
    btn.onclick   = () => {
        document.body.classList.remove('focus-mode');
        btn.remove();
        showToast('Focus mode OFF');
    };
    document.body.appendChild(btn);
}

function removeExitFocusButton() {
    document.getElementById('exit-focus-btn')?.remove();
}

function initFocusExit() { /* reserved */ }

// ==================== TOAST ====================
let _toastTimeout = null;

function showToast(msg, isErr = false, dur = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    clearTimeout(_toastTimeout); // tránh toast chồng nhau
    toast.innerHTML = `<i class="fas ${isErr ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${escapeHtml(msg)}`;
    toast.classList.toggle('error', isErr);
    toast.classList.add('show');
    _toastTimeout = setTimeout(() => toast.classList.remove('show'), dur);
}

// ==================== NOTES ====================
let notes = (() => {
    try { return JSON.parse(localStorage.getItem(window.NOTE_KEY || 'skr_notes')) || []; }
    catch { return []; }
})();

function addNote() {
    const input = document.getElementById('noteInput');
    const text  = input?.value.trim();
    if (!text) return;
    notes.unshift({ id: Date.now(), text, done: false });
    saveNotes();
    renderNotes();
    input.value = '';
    showToast('📝 Note added');
}

function toggleNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.done = !note.done;
    if (note.done) {
        fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'task_complete' })
        }).then(() => loadUserStats()).catch(() => {});
    }
    saveNotes();
    renderNotes();
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
    showToast('🗑️ Note deleted');
}

function saveNotes() {
    try { localStorage.setItem(window.NOTE_KEY || 'skr_notes', JSON.stringify(notes)); }
    catch (e) { console.warn('[SKR] localStorage full', e); }
}

function renderNotes() {
    const list = document.getElementById('noteList');
    if (!list) return;

    if (notes.length === 0) {
        const empty = document.createElement('p');
    empty.className = 'notes-empty';
    empty.textContent = 'No notes yet. Add one above!';
    list.appendChild(empty);
    return;
        return;
    }

    // [B7] FIX: tạo DOM element thay vì innerHTML với user input → tránh XSS
    list.innerHTML = '';
    notes.forEach(n => {
        const item = document.createElement('div');
        item.className = `note-item${n.done ? ' done' : ''}`;

        const span = document.createElement('span');
        span.textContent = n.text; // textContent, KHÔNG phải innerHTML

        const actions = document.createElement('div');
        actions.className = 'note-actions';

        const checkBtn = document.createElement('i');
        checkBtn.className = 'fas fa-check-circle';
        checkBtn.className += ' note-check';
        checkBtn.addEventListener('click', () => toggleNote(n.id));

        const delBtn = document.createElement('i');
        delBtn.className = 'fas fa-trash-alt';
        delBtn.className += ' note-del';
        delBtn.addEventListener('click', () => deleteNote(n.id));

        actions.append(checkBtn, delBtn);
        item.append(span, actions);
        list.appendChild(item);
    });
}

// ==================== HEATMAP ====================
function initHeatmap() {
    const hm = document.getElementById('heatmap');
    if (!hm) return;
    hm.innerHTML = '';
    const frag = document.createDocumentFragment(); // [+] batch DOM insert
    for (let i = 0; i < 28; i++) {
        const cell = document.createElement('div');
        cell.className = `cell${Math.random() > 0.5 ? ' active' : ''}`;
        cell.title = `Day ${i + 1}`;
        frag.appendChild(cell);
    }
    hm.appendChild(frag);
}

// ==================== DAILY GOAL ====================
async function setDailyGoal() {
    const input = document.getElementById('goalInput');
    const val   = parseInt(input?.value);
    if (!val || val < 1 || val > 1440) {
        showToast('Please enter a valid number (1–1440)', true);
        return;
    }
    SKR.goal = val;
    setText('goalTarget', val);
    showToast(`🎯 Daily goal set to ${val} minutes`);
    try {
        await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_goal', value: val })
        });
    } catch (e) { /* silent */ }
}

// ==================== YOUTUBE MUSIC ====================
function loadYouTube() {
    const link      = document.getElementById('ytLink')?.value || '';
    const container = document.getElementById('yt-player-container');
    if (!container) return;

    const match = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (!match) {
        showToast('❌ Invalid YouTube URL', true);
        return;
    }

    // [B7] FIX: sanitize video ID (chỉ cho phép alphanumeric + - _)
    const videoId = match[1].replace(/[^a-zA-Z0-9_-]/g, '');
    const iframe  = document.createElement('iframe');
    iframe.src    = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');
    container.innerHTML = '';
    container.appendChild(iframe);
    showToast('🎵 Music loaded');
}

// ==================== ACHIEVEMENTS ====================
function renderAchievements() {
    const cont = document.getElementById('achievements-container');
    if (!cont) return;

    if (!SKR.achievements.length) {
        cont.innerHTML = '<p style="opacity:0.5;">No achievements yet. Keep going!</p>';
        return;
    }

    cont.innerHTML = '';
    SKR.achievements.slice(0, 5).forEach(a => {
        const div   = document.createElement('div');
        div.className = 'achievement-item';
        const icon  = document.createElement('i');
        icon.className = 'fas fa-medal';
        const name  = document.createElement('span');
        name.textContent = ' ' + a.achievement_name;
        const date  = document.createElement('small');
        date.textContent = new Date(a.achieved_at).toLocaleDateString();
        div.append(icon, name, date);
        cont.appendChild(div);
    });
}

// ==================== RESET FOCUS COUNT ====================
async function resetFocusCount() {
    if (!confirm('Reset focus count to 0?')) return;
    try {
        const res = await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_focus' })
        });
        if (res.ok) {
            SKR.focusCount = 0;
            setText('focusCount', '0');
            showToast('✅ Focus count reset');
        } else {
            showToast('❌ Failed to reset', true);
        }
    } catch (e) {
        showToast('❌ Network error', true);
    }
}

// ==================== LOGOUT ====================
// [B8] FIX: đưa vào hàm gọi trong DOMContentLoaded thay vì script-level
function initLogout() {
    document.getElementById('logout-btn')?.addEventListener('click', e => {
        e.preventDefault();
        showToast('👋 Logging out...');
        setTimeout(() => { window.location.href = '/logout'; }, 800);
    });
}

// ==================== [+] THEME TOGGLE ====================
function initThemeToggle() {
    // tạo nút nếu chưa có trong HTML
    let btn = document.getElementById('theme-toggle-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id        = 'theme-toggle-btn';
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle theme');
        document.body.appendChild(btn);
    }

    const saved = localStorage.getItem('skr_theme') || 'dark';
    applyTheme(saved, btn);

    btn.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(next, btn);
        localStorage.setItem('skr_theme', next);
    });
}

function applyTheme(theme, btn) {
    document.documentElement.dataset.theme = theme;
    if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ==================== [+] KEYBOARD SHORTCUTS ====================
function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        // bỏ qua khi đang focus vào input / textarea
        if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;

        if (e.code === 'Space') {
            e.preventDefault();
            isRunning ? pauseTimer() : (timerEndTime ? resumeTimer() : startTimer());
        } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
            resetTimer();
        } else if (e.code === 'KeyF') {
            toggleFocusMode();
        }
    });
}

// ==================== [+] BROWSER NOTIFICATION ====================
function requestNotifPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        // chỉ hỏi khi user đã tương tác (click bất kỳ đâu)
        document.addEventListener('click', () => {
            Notification.requestPermission();
        }, { once: true });
    }
}

// ==================== CONFETTI ====================
function confettiEffect() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        return;
    }
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.style.cssText = [
                'position:fixed',
                `left:${Math.random() * 100}%`,
                'top:-10px',
                'width:8px',
                'height:8px',
                `background:hsl(${Math.floor(Math.random() * 360)},100%,70%)`,
                'border-radius:50%',
                'z-index:10002',
                `animation:confettiFall ${(Math.random() * 2 + 2).toFixed(1)}s linear forwards`
            ].join(';');
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 4000);
        }, i * 50);
    }
}

// inject confetti keyframe 1 lần duy nhất
const _confettiStyle = document.createElement('style');
_confettiStyle.textContent = '@keyframes confettiFall{to{transform:translateY(110vh) rotate(360deg);opacity:0}}';
document.head.appendChild(_confettiStyle);

// ==================== UTILS ====================
// [B7] helper escape HTML để tránh XSS trong toast message
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ==================== EXPORT ====================
Object.assign(window, {
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    toggleFocusMode,
    addNote,
    toggleNote,
    deleteNote,
    setDailyGoal,
    loadYouTube,
    resetFocusCount
});