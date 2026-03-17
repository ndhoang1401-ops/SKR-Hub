/**
 * SKR-HUB dashboard.js v4.0 — VIP PRO MAX
 * Tích hợp:
 * - Alarm với preload âm thanh, fallback visual
 * - Focus mode + ghi chú Pomodoro hiển thị ở rank
 * - Achievements đẹp mắt, heatmap động
 * - Music Zone với Lofi, YouTube, Spotify, SoundCloud
 * - Theme toggle sáng/tối, keyboard shortcuts
 * - Hiệu ứng confetti, toast, sakura petals
 */

// ============================================
// 1. STATE & CONSTANTS
// ============================================
const SKR = {
    xp: 0, level: 1, streak: 0, goal: 30,
    totalMinutes: 0, focusCount: 0,
    xp_for_level: 0, xp_for_next: 100,
    achievements: [],
    ranks: ['⚡ NEWBIE', '🌟 SCHOLAR', '🔥 MASTER', '💫 PRODIGY', '👑 SKR GOD'],
    rankMsg: [
        'Every master was once a beginner.',
        "You're on fire! Consistency is key.",
        'Greatness is built one day at a time.',
        "Unstoppable! The sky is the limit.",
        'Legendary. Inspire others!'
    ],
    quotes: [
        'Discipline is the bridge between goals and accomplishment.',
        "Don't watch the clock; do what it does. Keep going.",
        'Success is the sum of small efforts, repeated day in and day out.',
        'The expert in anything was once a beginner.',
        'Your only limit is your mind.',
        'Focus on being productive instead of busy.',
        'The future depends on what you do today.'
    ]
};

const ACHIEVEMENTS = [
    { key: 'first_focus', icon: '🎯', name: 'First Step', desc: 'First focus session' },
    { key: 'focus_5', icon: '🧠', name: 'Deep Thinker', desc: '5 focus sessions' },
    { key: 'focus_10', icon: '🏆', name: 'Focus Master', desc: '10 focus sessions' },
    { key: 'focus_25', icon: '⚡', name: 'Zen Mode', desc: '25 focus sessions' },
    { key: 'streak_3', icon: '🔥', name: '3-Day Streak', desc: '3 days in a row' },
    { key: 'streak_7', icon: '💥', name: 'Week Streak', desc: '7 days in a row' },
    { key: 'streak_30', icon: '🌟', name: 'Month Legend', desc: '30 days straight' },
    { key: 'xp_100', icon: '✨', name: 'Rising Star', desc: '100 XP earned' },
    { key: 'xp_500', icon: '💫', name: 'XP Hunter', desc: '500 XP earned' },
    { key: 'xp_1000', icon: '👑', name: 'XP Legend', desc: '1,000 XP earned' },
    { key: 'notes_5', icon: '📝', name: 'Note Taker', desc: '5 notes added' },
    { key: 'level_3', icon: '🚀', name: 'Fast Learner', desc: 'Reach Level 3' },
    { key: 'level_5', icon: '💎', name: 'Elite Scholar', desc: 'Reach Level 5' },
    { key: 'level_10', icon: '🌈', name: 'SKR Deity', desc: 'Reach Level 10' },
];

// ============================================
// 2. AUDIO & ALARM (với fallback mạnh mẽ)
// ============================================
let _audioUnlocked = false;

function initAudioUnlock() {
    const unlock = () => {
        if (_audioUnlocked) return;
        // Âm thanh silent để đánh thức AudioContext
        const silent = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2ozNWKi2NyraTI1Y6La3KtpMjNjodrcq2kyM2Oh2tyraTA0ZKLb3KtoMTRlo9zcq2gxM2Wj3NyraDE0ZaTc3KtpMDRlpNzcq2oxM2ek3NyraTE0Z6Xc3KtqMTVopd3cq2oxNGim3dyrajE0aanc3KtrMjRqqdzcq2syM2uq3NyraTM0a6rc3KtpMzRsq9zcq2kzNGyr3NyraTM0a6rc3KtpMzRsq9zcq2kzNGyr3NyraTM0a6rc3KtpMzRsq9zcq2kzNGyr3NyraTM0a6rc3KtpMzRsq9zcq2kzNGyr3NyraTM0a6rc3KtpMzRsq9zcq2kzNGyr3NyraTM=');
        silent.volume = 0.001;
        silent.play().then(() => { _audioUnlocked = true; }).catch(() => {});
    };
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
}

function getAlarmUrl() {
    const sel = document.getElementById('alarmSound');
    if (!sel) return null;
    const opt = sel.options[sel.selectedIndex];
    return opt?.dataset?.url || null;
}

function getVolume() {
    return parseFloat(document.getElementById('volumeSlider')?.value ?? '0.8');
}

async function playAlarmSound() {
    const url = getAlarmUrl();
    if (!url) return;
    const vol = getVolume();

    // Method 1: Audio element (đơn giản, nhanh)
    try {
        const a = new Audio(url);
        a.volume = Math.max(0, Math.min(1, vol));
        await a.play();
        return;
    } catch (_) {}

    // Method 2: AudioContext (fallback cho trình duyệt chặn autoplay)
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') await ctx.resume();
        const resp = await fetch(url);
        const buf = await ctx.decodeAudioData(await resp.arrayBuffer());
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.value = vol;
        src.buffer = buf;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start(0);
    } catch (e) {
        console.warn('[SKR] Alarm audio failed:', e);
        // Fallback visual: nhấp nháy timer
        document.getElementById('timerDisplay')?.animate(
            [{ color: '#ff7eb3' }, { color: '#00eaff' }, { color: '#ff7eb3' }],
            { duration: 500, iterations: 6 }
        );
    }
}

function testAlarm() {
    playAlarmSound();
    showToast('🔔 Testing alarm...');
}

// ============================================
// 3. KHỞI TẠO & TIỆN ÍCH CHUNG
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    const uid = document.querySelector('meta[name="skr-uid"]')?.content || '0';
    window.SKR_UID = uid;
    window.NOTE_KEY = `skr_notes_${uid}`;

    initWelcome();
    initSakura();
    initQuote();
    initAudioUnlock();
    await loadStats();
    initHeatmap();
    renderNotes();
    loadLatestNote();          // 👈 load Pomodoro note từ localStorage
    initThemeToggle();
    initKeyboard();
    requestNotifPerm();
    startTimeTracker();
    initLogout();
});

// ============================================
// 4. WELCOME OVERLAY
// ============================================
function initWelcome() {
    const el = document.getElementById('welcome-overlay');
    if (!el) return;
    setTimeout(() => {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        setTimeout(() => el.remove(), 1000);
    }, 2500);
}

// ============================================
// 5. SAKURA PETALS (cánh hoa đào rơi)
// ============================================
const PETALS = ['🌸', '💮', '✨', '🌸', '🌸'];
function initSakura() {
    setInterval(() => {
        if (document.hidden) return;
        if (document.querySelectorAll('.sakura-petal').length >= 25) return;
        const p = document.createElement('div');
        p.className = 'sakura-petal';
        p.textContent = PETALS[Math.random() * PETALS.length | 0];
        const dur = (Math.random() * 6 + 7).toFixed(1);
        const delay = (Math.random() * 2).toFixed(1);
        p.style.cssText = `left:${(Math.random() * 100).toFixed(1)}vw;font-size:${(Math.random() * 16 + 12) | 0}px;animation-duration:${dur}s;animation-delay:${delay}s`;
        document.body.appendChild(p);
        p.addEventListener('mouseenter', () => {
            p.classList.add('linger');
            setTimeout(() => p.remove(), 1000);
        }, { once: true });
        setTimeout(() => {
            if (p.isConnected) p.remove();
        }, (+dur + +delay + 0.5) * 1000);
    }, 350);
}

// ============================================
// 6. QUOTE NGẪU NHIÊN
// ============================================
function initQuote() {
    const el = document.getElementById('daily-quote');
    if (el) el.textContent = `"${SKR.quotes[new Date().getDate() % SKR.quotes.length]}"`;
}

// ============================================
// 7. STATS & XP
// ============================================
async function loadStats() {
    try {
        const res = await fetch('/api/user/stats');
        if (!res.ok) throw new Error();
        const d = await res.json();
        SKR.xp = d.xp || 0;
        SKR.xp_for_level = d.xp_for_level ?? 0;
        SKR.xp_for_next = d.xp_for_next ?? 100;
        SKR.level = d.level || 1;
        SKR.streak = d.streak || 0;
        SKR.totalMinutes = d.total_minutes || 0;
        SKR.goal = d.goal || 30;
        SKR.focusCount = d.focus_count || 0;
        SKR.achievements = d.achievements || [];
        updateUI();
    } catch {
        // fallback localStorage
        SKR.xp = parseInt(localStorage.getItem('skr_xp')) || 0;
        SKR.level = parseInt(localStorage.getItem('skr_level')) || 1;
        SKR.streak = parseInt(localStorage.getItem('skr_streak')) || 0;
        updateUI();
    }
}

function updateUI() {
    const ri = Math.min(SKR.level - 1, SKR.ranks.length - 1);
    setText('lvlNumber', SKR.level);
    setText('rankName', SKR.ranks[ri]);
    setText('rankMessage', SKR.rankMsg[ri]);
    setText('streakCount', SKR.streak);
    setText('focusCount', SKR.focusCount);
    setText('goalDisplay', SKR.totalMinutes);
    setText('goalTarget', SKR.goal);

    // XP progress
    const start = SKR.xp_for_level ?? xpForLevel(SKR.level);
    const end = SKR.xp_for_next ?? xpForLevel(SKR.level + 1);
    const inLvl = Math.max(0, SKR.xp - start);
    const needed = Math.max(1, end - start);
    const pct = Math.min(100, (inLvl / needed) * 100);

    setText('currentXp', inLvl);
    setText('xpMax', needed);
    const fill = document.getElementById('xpFill');
    if (fill) {
        fill.style.width = pct.toFixed(1) + '%';
        fill.setAttribute('aria-valuenow', Math.round(pct));
    }

    // Goal bar
    const gPct = SKR.goal > 0 ? Math.min(100, (SKR.totalMinutes / SKR.goal) * 100) : 0;
    const gFill = document.getElementById('goalBarFill');
    if (gFill) gFill.style.width = gPct.toFixed(1) + '%';
    setText('goalPct', Math.round(gPct) + '%');

    renderAchievements();
}

function xpForLevel(l) {
    if (l <= 1) return 0;
    return Math.floor(50 * Math.pow(l - 1, 1.6));
}

let _statTimer = null;
async function addXP(amt) {
    try {
        const res = await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'xp_time', value: amt })
        });
        const d = await res.json();
        if (d.level_up > 0) {
            showToast('🎉 LEVEL UP!', false, 5000);
            confetti();
        }
        clearTimeout(_statTimer);
        _statTimer = setTimeout(loadStats, 3000);
    } catch { }
}

// ============================================
// 8. TIME TRACKER (tự động cộng XP mỗi phút)
// ============================================
let _lt = Date.now(), _acc = 0;
function startTimeTracker() {
    setInterval(() => {
        if (document.hidden) { _lt = Date.now(); return; }
        const now = Date.now();
        _acc += now - _lt; _lt = now;
        if (_acc >= 60000) {
            _acc -= 60000;
            addXP(1);
        }
    }, 1000);
}

// ============================================
// 9. POMODORO TIMER
// ============================================
let timerInterval = null, timerEndMs = null, timerRemMs = 25 * 60 * 1000;
let isRunning = false;
let _totalMs = 25 * 60 * 1000; // for arc progress

function adjustTimer(id, delta) {
    const el = document.getElementById(id);
    if (!el) return;
    const max = id === 'setH' ? 99 : 59;
    el.value = String(Math.min(max, Math.max(0, (parseInt(el.value) || 0) + delta))).padStart(2, '0');
    if (!isRunning) resetDisplay();
}

function getTimerMs() {
    const h = parseInt(document.getElementById('setH')?.value) || 0;
    const m = parseInt(document.getElementById('setM')?.value) || 0;
    const s = parseInt(document.getElementById('setS')?.value) || 0;
    return ((h * 3600 + m * 60 + s) || 25 * 60) * 1000;
}

function startTimer() {
    if (isRunning) return;
    clearInterval(timerInterval);
    _totalMs = timerRemMs > 1000 ? timerRemMs : getTimerMs();
    timerRemMs = _totalMs;
    timerEndMs = Date.now() + _totalMs;
    isRunning = true;
    timerInterval = setInterval(tickTimer, 250);
    document.getElementById('startBtn')?.classList.add('running');
    showToast('⏳ Focus session started!');
    _audioUnlocked = true; // user đã tương tác
}

function tickTimer() {
    if (!isRunning) return;
    const rem = timerEndMs - Date.now();
    if (rem <= 0) { handleComplete(); return; }
    timerRemMs = rem;
    updateTimerDisplay(rem);
    updateArc(rem);
}

function pauseTimer() {
    if (!isRunning) return;
    timerRemMs = Math.max(0, timerEndMs - Date.now());
    clearInterval(timerInterval);
    isRunning = false;
    document.getElementById('startBtn')?.classList.remove('running');
    showToast('⏸️ Paused');
}

function resumeTimer() {
    if (isRunning || timerRemMs <= 0) return;
    timerEndMs = Date.now() + timerRemMs;
    isRunning = true;
    timerInterval = setInterval(tickTimer, 250);
    showToast('▶️ Resumed');
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    timerEndMs = null;
    timerRemMs = getTimerMs();
    _totalMs = timerRemMs;
    document.getElementById('startBtn')?.classList.remove('running');
    resetDisplay();
    showToast('↺ Reset');
}

function resetDisplay() {
    updateTimerDisplay(getTimerMs());
    updateArc(getTimerMs(), getTimerMs());
}

function updateTimerDisplay(ms) {
    const tot = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(tot / 3600);
    const m = Math.floor((tot % 3600) / 60);
    const s = tot % 60;
    const disp = document.getElementById('timerDisplay');
    if (disp) disp.textContent = `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateArc(remMs, totalMs) {
    const arc = document.getElementById('timerArc');
    if (!arc) return;
    const total = totalMs ?? _totalMs;
    const pct = total > 0 ? Math.max(0, Math.min(1, remMs / total)) : 1;
    const circ = 2 * Math.PI * 68; // r=68
    arc.style.strokeDasharray = circ.toFixed(2);
    arc.style.strokeDashoffset = (circ * (1 - pct)).toFixed(2);
}

async function handleComplete() {
    clearInterval(timerInterval);
    isRunning = false;
    timerRemMs = 0;
    document.getElementById('startBtn')?.classList.remove('running');
    updateArc(0, _totalMs);

    // Phát âm thanh báo thức
    playAlarmSound();

    // Thông báo trình duyệt nếu tab đang ẩn
    if (document.hidden && Notification.permission === 'granted') {
        new Notification('SKR-HUB ✅', { body: 'Focus session complete! +30 XP', icon: '/static/icon.png' });
    }

    try {
        const res = await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'focus_complete' })
        });
        const d = await res.json();
        if (d.level_up) {
            showToast('🎉 LEVEL UP!', false, 4000);
            confetti();
        }
        loadStats();
    } catch { }

    showToast('✅ Session complete! +30 XP', false, 4500);

    // Reset timer cho lần tiếp theo
    timerRemMs = getTimerMs();
    _totalMs = timerRemMs;
    updateTimerDisplay(timerRemMs);
    updateArc(timerRemMs, timerRemMs);
}

// ============================================
// 10. FOCUS MODE & GHI CHÚ POMODORO
// ============================================
let focusActive = false;
function toggleFocusMode() {
    focusActive = !focusActive;
    document.body.classList.toggle('focus-mode', focusActive);

    const btn = document.getElementById('focusModeBtn');
    const label = document.getElementById('focusModeLabel');
    const noteContainer = document.querySelector('.focus-note-container'); // lấy container

    if (focusActive) {
        btn?.classList.add('active');
        if (label) label.textContent = 'Exit Focus';
        if (noteContainer) noteContainer.style.display = 'block'; // hiện ghi chú
        showToast('🎯 Focus mode ON — ghi chú Pomodoro');
    } else {
        btn?.classList.remove('active');
        if (label) label.textContent = 'Focus Mode';
        if (noteContainer) noteContainer.style.display = 'none'; // ẩn ghi chú
        showToast('Focus mode OFF');
    }
}

function saveFocusNote() {
    const note = document.getElementById('focusNote')?.value.trim();
    if (!note) {
        showToast('📝 Nhập ghi chú đi bạn!', true);
        return;
    }
    localStorage.setItem('latestPomodoroNote', note);
    document.getElementById('latestNoteText').innerText = note;
    showToast('✅ Đã lưu note vào rank');
}

function loadLatestNote() {
    const saved = localStorage.getItem('latestPomodoroNote');
    if (saved) {
        document.getElementById('latestNoteText').innerText = saved;
    }
}

// ============================================
// 11. TOAST NOTIFICATION
// ============================================
let _tm = null;
function showToast(msg, err = false, dur = 3000) {
    const t = document.getElementById('toast');
    if (!t) return;
    clearTimeout(_tm);
    t.innerHTML = `<i class="fas ${err ? 'fa-exclamation-circle' : 'fa-check-circle'}" aria-hidden="true"></i> ${esc(msg)}`;
    t.classList.toggle('toast--error', err);
    t.classList.add('show');
    _tm = setTimeout(() => t.classList.remove('show'), dur);
}

// ============================================
// 12. NOTES (ghi chú nhanh)
// ============================================
let notes = (() => {
    try { return JSON.parse(localStorage.getItem(window.NOTE_KEY || 'skr_notes')) || []; } catch { return []; }
})();

function addNote() {
    const inp = document.getElementById('noteInput');
    const txt = inp?.value.trim();
    if (!txt) return;
    notes.unshift({ id: Date.now(), text: txt, done: false });
    saveNotes();
    renderNotes();
    inp.value = '';
    showToast('📝 Note added');
}

function toggleNote(id) {
    const n = notes.find(n => n.id === id);
    if (!n) return;
    n.done = !n.done;
    if (n.done) {
        fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'task_complete' })
        }).then(() => loadStats()).catch(() => { });
    }
    saveNotes();
    renderNotes();
}

function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
    showToast('🗑️ Deleted');
}

function saveNotes() {
    try { localStorage.setItem(window.NOTE_KEY || 'skr_notes', JSON.stringify(notes)); } catch { }
}

function renderNotes() {
    const list = document.getElementById('noteList');
    if (!list) return;
    list.innerHTML = '';

    if (!notes.length) {
        const e = document.createElement('p');
        e.className = 'notes-empty';
        e.textContent = '✨ No notes yet — add one above!';
        list.appendChild(e);
        return;
    }

    notes.forEach(n => {
        const row = document.createElement('div');
        row.className = `note-row${n.done ? ' note-row--done' : ''}`;
        row.setAttribute('role', 'listitem');

        const txt = document.createElement('span');
        txt.className = 'note-text';
        txt.textContent = n.text;

        const acts = document.createElement('div');
        acts.className = 'note-actions';

        const chk = makeNoteBtn(
            n.done ? 'fa-check-circle' : 'fa-circle',
            `note-btn note-btn--check${n.done ? ' checked' : ''}`,
            n.done ? 'Mark undone' : 'Mark done',
            () => toggleNote(n.id)
        );
        const del = makeNoteBtn(
            'fa-trash-alt',
            'note-btn note-btn--del',
            'Delete note',
            () => deleteNote(n.id)
        );

        acts.append(chk, del);
        row.append(txt, acts);
        list.appendChild(row);
    });
}

function makeNoteBtn(iconClass, className, title, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = `<i class="fas ${iconClass}" aria-hidden="true"></i>`;
    btn.addEventListener('click', onClick);
    return btn;
}

// ============================================
// 13. HEATMAP (hoạt động 28 ngày)
// ============================================
function initHeatmap() {
    const hm = document.getElementById('heatmap');
    if (!hm) return;
    hm.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 28; i++) {
        const c = document.createElement('div');
        c.className = `hm-cell${Math.random() > 0.55 ? ' hm-cell--active' : ''}`;
        c.title = `Day ${i + 1}`;
        frag.appendChild(c);
    }
    hm.appendChild(frag);
}

// ============================================
// 14. ACHIEVEMENTS (huy hiệu)
// ============================================
function renderAchievements() {
    const cont = document.getElementById('achievements-container');
    if (!cont) return;
    cont.innerHTML = '';

    const earned = new Map(
        SKR.achievements.map(a => [
            (a.achievement_name || '').toLowerCase().replace(/[\s-]+/g, '_'),
            a.achieved_at
        ])
    );

    const frag = document.createDocumentFragment();
    ACHIEVEMENTS.forEach(def => {
        const isOn = earned.has(def.key);
        const b = document.createElement('div');
        b.className = `ach-badge${isOn ? ' ach-badge--earned' : ' ach-badge--locked'}`;
        b.setAttribute('role', 'listitem');
        b.setAttribute('title', def.desc + (isOn ? '\n✅ Earned' : '\n🔒 Locked'));

        b.innerHTML = `
            <span class="ach-badge-icon">${def.icon}</span>
            <span class="ach-badge-name">${def.name}</span>
            ${isOn ? '' : '<span class="ach-badge-lock"><i class="fas fa-lock" aria-hidden="true"></i></span>'}
        `;
        frag.appendChild(b);
    });
    cont.appendChild(frag);

    const cnt = document.getElementById('achCount');
    if (cnt) cnt.textContent = `${earned.size} / ${ACHIEVEMENTS.length}`;
}

// ============================================
// 15. DAILY GOAL
// ============================================
async function setDailyGoal() {
    const v = parseInt(document.getElementById('goalInput')?.value);
    if (!v || v < 1 || v > 1440) {
        showToast('Enter 1–1440 min', true);
        return;
    }
    SKR.goal = v;
    setText('goalTarget', v);
    updateUI();
    showToast(`🎯 Goal: ${v} min/day`);
    try {
        await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_goal', value: v })
        });
    } catch { }
}

// ============================================
// 16. MUSIC ZONE
// ============================================
const PANELS = ['lofi', 'youtube', 'spotify', 'soundcloud'];

function switchPlatform(btn) {
    document.querySelectorAll('.platform-pill').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    const p = btn.dataset.platform;
    PANELS.forEach(id => {
        const panel = document.getElementById(`${id}-panel`);
        if (panel) panel.classList.toggle('music-panel--active', id === p);
    });
}

function playLofi(videoId, btn) {
    document.querySelectorAll('.lofi-card').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    embedYT(videoId);
    showToast('🎧 Lofi đang phát...');
}

function loadYouTube() {
    const url = document.getElementById('ytInput')?.value.trim() || '';
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!m) {
        showToast('❌ Invalid YouTube URL', true);
        return;
    }
    embedYT(m[1]);
    showToast('▶️ YouTube loaded');
}

function loadSpotify() {
    const url = document.getElementById('spInput')?.value.trim() || '';
    const m = url.match(/open\.spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/);
    if (!m) {
        showToast('❌ Invalid Spotify URL', true);
        return;
    }
    const [, type, id] = m;
    const compact = type === 'track' || type === 'episode';
    const iframe = document.createElement('iframe');
    iframe.src = `https://open.spotify.com/embed/${type}/${id}?theme=0`;
    iframe.setAttribute('allow', 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
    iframe.setAttribute('loading', 'lazy');
    iframe.className = 'music-iframe';
    iframe.height = compact ? '152' : '352';
    setPlayer(iframe);
    showToast('🟢 Spotify loaded');
}

function loadSoundCloud() {
    const url = document.getElementById('scInput')?.value.trim() || '';
    if (!url.includes('soundcloud.com')) {
        showToast('❌ Invalid SoundCloud URL', true);
        return;
    }
    const iframe = document.createElement('iframe');
    iframe.src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff7eb3&auto_play=true&hide_related=true&show_comments=false`;
    iframe.className = 'music-iframe sc-iframe';
    setPlayer(iframe);
    showToast('🔶 SoundCloud loaded');
}

function embedYT(videoId) {
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    iframe.setAttribute('allow', 'autoplay; encrypted-media');
    iframe.setAttribute('allowfullscreen', '');
    iframe.className = 'music-iframe yt-iframe';
    setPlayer(iframe);
}

function setPlayer(iframe) {
    iframe.setAttribute('frameborder', '0');
    const p = document.getElementById('music-player');
    if (p) {
        p.innerHTML = '';
        p.appendChild(iframe);
    }
}

// ============================================
// 17. RESET FOCUS COUNT
// ============================================
async function resetFocusCount() {
    if (!confirm('Reset focus count to 0?')) return;
    try {
        await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_focus' })
        });
        SKR.focusCount = 0;
        setText('focusCount', '0');
        showToast('✅ Reset');
    } catch {
        showToast('❌ Error', true);
    }
}

// ============================================
// 18. LOGOUT
// ============================================
function initLogout() {
    document.getElementById('logout-btn')?.addEventListener('click', e => {
        e.preventDefault();
        showToast('👋 Bye!');
        setTimeout(() => { window.location.href = '/logout'; }, 800);
    });
}

// ============================================
// 19. THEME TOGGLE (sáng/tối)
// ============================================
function initThemeToggle() {
    let btn = document.getElementById('theme-toggle-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.className = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle theme');
        document.body.appendChild(btn);
    }
    applyTheme(localStorage.getItem('skr_theme') || 'dark', btn);
    btn.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        applyTheme(next, btn);
        localStorage.setItem('skr_theme', next);
    });
}

function applyTheme(t, btn) {
    document.documentElement.dataset.theme = t;
    if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
}

// ============================================
// 20. KEYBOARD SHORTCUTS
// ============================================
function initKeyboard() {
    document.addEventListener('keydown', e => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        if (e.code === 'Space') {
            e.preventDefault();
            if (isRunning) pauseTimer();
            else if (timerEndMs) resumeTimer();
            else startTimer();
        } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
            resetTimer();
        } else if (e.code === 'KeyF') {
            toggleFocusMode();
        }
    });
}

// ============================================
// 21. NOTIFICATION PERMISSION
// ============================================
function requestNotifPerm() {
    if ('Notification' in window && Notification.permission === 'default') {
        document.addEventListener('click', () => Notification.requestPermission(), { once: true });
    }
}

// ============================================
// 22. CONFETTI
// ============================================
function confetti() {
    if (typeof window.confetti === 'function') {
        window.confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
        return;
    }
    // Fallback tự chế
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const c = document.createElement('div');
            c.style.cssText = `position:fixed;left:${Math.random() * 100}%;top:-10px;width:8px;height:8px;background:hsl(${Math.random() * 360 | 0},100%,70%);border-radius:50%;z-index:10002;animation:cFall ${(Math.random() * 2 + 2).toFixed(1)}s linear forwards`;
            document.body.appendChild(c);
            setTimeout(() => c.remove(), 4500);
        }, i * 50);
    }
}
// Thêm keyframes cho confetti fallback
const _s = document.createElement('style');
_s.textContent = '@keyframes cFall{to{transform:translateY(110vh) rotate(360deg);opacity:0}}';
document.head.appendChild(_s);

// ============================================
// 23. UTILITIES
// ============================================
function setText(id, v) {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
}
function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================
// 24. EXPORT GLOBAL (cho onclick trong HTML)
// ============================================
Object.assign(window, {
    startTimer, pauseTimer, resumeTimer, resetTimer, adjustTimer,
    toggleFocusMode, resetFocusCount, testAlarm,
    addNote, toggleNote, deleteNote, setDailyGoal,
    loadYouTube, loadSpotify, loadSoundCloud, playLofi, switchPlatform,
    saveFocusNote  // 👈 thêm để nút trong focus mode hoạt động
});