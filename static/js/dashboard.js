/**
 * SKR-HUB DASHBOARD MASTER ULTIMATE
 * All features: XP, Pomodoro, Notes, Streak, Focus, Music, Toast, Achievements
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
});

// ==================== WELCOME ====================
function initWelcome() {
    const overlay = document.getElementById('welcome-overlay');
    if (overlay) {
        setTimeout(() => {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            setTimeout(() => overlay.remove(), 1000);
        }, 2500);
    }
}

// ==================== SAKURA ====================
function initSakura() {
    const icons = ["🌸", "💮", "✨", "🌸", "🌸", "🌸"];
    setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        for (let i = 0; i < 2; i++) {
            createPetal();
        }
    }, 300);
}

function createPetal() {
    const petal = document.createElement("div");
    petal.className = "sakura-petal";
    petal.innerHTML = icons[Math.floor(Math.random() * icons.length)];
    petal.style.left = Math.random() * 100 + "vw";
    petal.style.fontSize = Math.random() * 20 + 15 + "px";
    petal.style.animationDuration = Math.random() * 6 + 6 + "s";
    petal.style.animationDelay = Math.random() * 2 + "s";
    petal.style.opacity = Math.random() * 0.6 + 0.4;
    document.body.appendChild(petal);

    petal.addEventListener('mouseenter', () => {
        petal.classList.add('linger');
        setTimeout(() => petal.remove(), 1000);
    });

    setTimeout(() => {
        if (Math.random() < 0.15) {
            petal.classList.add('linger');
            setTimeout(() => petal.remove(), 1000);
        } else {
            petal.remove();
        }
    }, 8000);
}

// ==================== QUOTE ====================
function initDailyQuote() {
    const quoteEl = document.getElementById('daily-quote');
    const random = SKR.quotes[Math.floor(Math.random() * SKR.quotes.length)];
    if (quoteEl) quoteEl.innerText = `"${random}"`;
}

// ==================== LEVEL & XP ====================
async function loadUserStats() {
    try {
        const res = await fetch('/api/user/stats');
        if (res.ok) {
            const data = await res.json();
            SKR.xp = data.xp || 0;
            SKR.level = data.level || 1;
            SKR.streak = data.streak || 0;
            SKR.totalMinutes = data.total_minutes || 0;
            SKR.goal = data.goal || 30;
            SKR.focusCount = data.focus_count || 0;
            SKR.tasksCompleted = data.tasks_completed || 0;
            SKR.achievements = data.achievements || [];
            
            updateLvlUI();
            document.getElementById('streakCount').innerText = SKR.streak;
            document.getElementById('goalDisplay').innerText = SKR.totalMinutes;
            document.getElementById('goalTarget').innerText = SKR.goal;
            document.getElementById('focusCount').innerText = SKR.focusCount;
            
            renderAchievements();
        } else {
            loadFromLocal();
        }
    } catch (e) {
        console.warn('Using local storage', e);
        loadFromLocal();
    }
}

function loadFromLocal() {
    SKR.xp = parseInt(localStorage.getItem('skr_xp')) || 0;
    SKR.level = parseInt(localStorage.getItem('skr_level')) || 1;
    SKR.streak = parseInt(localStorage.getItem('skr_streak')) || 0;
    SKR.focusCount = parseInt(localStorage.getItem('skr_focus_count')) || 0;
    updateLvlUI();
}

async function addXP(amount, reason = 'time') {
    try {
        const res = await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'xp_time', value: amount })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.level_up > 0) {
                showToast(`🎉 LEVEL UP!`, false, 5000);
                confettiEffect();
            }
            await loadUserStats(); // reload để cập nhật level và XP
        }
    } catch (e) {}
}

function updateLvlUI() {
    const rankIndex = Math.min(SKR.level - 1, SKR.ranks.length - 1);
    document.getElementById('lvlNumber').innerText = SKR.level;
    document.getElementById('rankName').innerText = SKR.ranks[rankIndex];
    document.getElementById('currentXp').innerText = SKR.xp;
    
    // Tính phần trăm XP cho thanh
    const nextLevelXp = getXpForLevel(SKR.level + 1);
    const currentLevelXp = getXpForLevel(SKR.level);
    const percent = ((SKR.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
    document.getElementById('xpFill').style.width = `${Math.min(100, percent)}%`;
    
    const rankMsg = document.getElementById('rankMessage');
    if (rankMsg) rankMsg.innerText = SKR.rankMessages[rankIndex] || SKR.rankMessages[0];
}

function getXpForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(100 * Math.pow(level - 1, 1.2));
}

// ==================== TIME TRACKER (mỗi phút +5 XP) ====================
let timeSeconds = 0;
function startTimeTracker() {
    setInterval(() => {
        timeSeconds++;
        if (timeSeconds % 60 === 0) {
            addXP(1, 'time'); // 1 phút = 5 XP (server nhân 5)
        }
    }, 1000);
}

// ==================== POMODORO PRO ====================
let timerInterval;
let timeLeft = 25 * 60;
let isRunning = false;
let volume = 0.7;

function initPomodoroControls() {
    // Tạo nút tăng/giảm cho input thời gian
    const hourInput = document.getElementById('setH');
    const minInput = document.getElementById('setM');
    const secInput = document.getElementById('setS');
    
    if (hourInput && minInput && secInput) {
        wrapInputWithButtons(hourInput, 'H');
        wrapInputWithButtons(minInput, 'M');
        wrapInputWithButtons(secInput, 'S');
    }
}

function wrapInputWithButtons(input, label) {
    const parent = input.parentNode;
    const wrapper = document.createElement('div');
    wrapper.className = 'time-input-group';
    
    const decBtn = document.createElement('button');
    decBtn.innerHTML = '−';
    decBtn.type = 'button';
    decBtn.addEventListener('click', () => {
        let val = parseInt(input.value) || 0;
        val = Math.max(0, val - 1);
        input.value = val.toString().padStart(2, '0');
    });
    
    const incBtn = document.createElement('button');
    incBtn.innerHTML = '+';
    incBtn.type = 'button';
    incBtn.addEventListener('click', () => {
        let val = parseInt(input.value) || 0;
        let max = (label === 'H') ? 99 : 59;
        val = Math.min(max, val + 1);
        input.value = val.toString().padStart(2, '0');
    });
    
    parent.insertBefore(wrapper, input);
    wrapper.appendChild(decBtn);
    wrapper.appendChild(input);
    wrapper.appendChild(incBtn);
    
    input.style.width = '60px';
    input.style.textAlign = 'center';
    input.classList.add('candy-input');
}

function initVolumeControl() {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 1;
    slider.step = 0.05;
    slider.value = volume;
    slider.className = 'volume-slider';
    
    const select = document.getElementById('alarmSound');
    if (select) {
        const volDiv = document.createElement('div');
        volDiv.className = 'volume-control';
        volDiv.innerHTML = '<i class="fas fa-volume-down"></i>';
        volDiv.appendChild(slider);
        volDiv.innerHTML += '<i class="fas fa-volume-up"></i>';
        select.parentNode.insertBefore(volDiv, select.nextSibling);
        
        slider.addEventListener('input', (e) => { volume = e.target.value; });
    }
}

function startTimer() {
    if (isRunning) return;
    const h = parseInt(document.getElementById('setH').value) || 0;
    const m = parseInt(document.getElementById('setM').value) || 0;
    const s = parseInt(document.getElementById('setS').value) || 0;
    timeLeft = (h*3600) + (m*60) + s;
    if (timeLeft === 0) timeLeft = 25*60;

    isRunning = true;
    timerInterval = setInterval(() => {
        if (timeLeft <= 0) handleTimerComplete();
        else { timeLeft--; updateDisplay(); }
    }, 1000);
    showToast('⏳ Focus session started!');
}

function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    showToast('⏸️ Timer paused');
}

function resetTimer() {
    pauseTimer();
    timeLeft = 25*60;
    updateDisplay();
    showToast('↺ Timer reset');
}

function updateDisplay() {
    const h = Math.floor(timeLeft / 3600);
    const m = Math.floor((timeLeft % 3600) / 60);
    const s = timeLeft % 60;
    const disp = document.getElementById('timerDisplay');
    if (disp) disp.innerText = `${h>0 ? h+':' : ''}${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function handleTimerComplete() {
    pauseTimer();
    const sound = new Audio(document.getElementById('alarmSound').value);
    sound.volume = volume;
    sound.play();
    
    fetch('/api/update_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'focus_complete' })
    })
    .then(res => res.json())
    .then(data => {
        if (data.level_up) showToast(`🎉 LEVEL UP!`, false, 4000);
        loadUserStats();
    });
    
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
    btn.id = 'exit-focus-btn';
    btn.className = 'candy-btn blue';
    btn.innerHTML = '<i class="fas fa-times"></i> EXIT FOCUS';
    btn.onclick = () => {
        document.body.classList.remove('focus-mode');
        btn.remove();
        showToast('Focus mode OFF');
    };
    document.body.appendChild(btn);
}

function removeExitFocusButton() {
    const btn = document.getElementById('exit-focus-btn');
    if (btn) btn.remove();
}

function initFocusExit() {}

// ==================== TOAST ====================
function showToast(msg, isErr = false, dur = 3000) {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fas ${isErr ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${msg}`;
    toast.classList.add('show');
    if (isErr) toast.classList.add('error');
    else toast.classList.remove('error');
    setTimeout(() => toast.classList.remove('show'), dur);
}

// ==================== NOTES ====================
let notes = JSON.parse(localStorage.getItem('skr_notes')) || [];

function addNote() {
    const input = document.getElementById('noteInput');
    const text = input.value.trim();
    if (!text) return;
    notes.unshift({ id: Date.now(), text, done: false });
    saveNotes();
    renderNotes();
    input.value = '';
    showToast('📝 Note added');
}

function toggleNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        note.done = !note.done;
        if (note.done) {
            fetch('/api/update_stats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'task_complete' })
            }).then(() => loadUserStats());
        }
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
    localStorage.setItem('skr_notes', JSON.stringify(notes));
}

function renderNotes() {
    const list = document.getElementById('noteList');
    if (!list) return;
    if (notes.length === 0) {
        list.innerHTML = '<p style="opacity:0.5; text-align:center;">No notes yet. Add one!</p>';
        return;
    }
    list.innerHTML = notes.map(n => `
        <div class="note-item ${n.done ? 'done' : ''}">
            <span>${n.text}</span>
            <div style="display:flex; gap:15px;">
                <i class="fas fa-check-circle" style="color:#00ff88; cursor:pointer;" onclick="toggleNote(${n.id})"></i>
                <i class="fas fa-trash-alt" style="color:#ff4d4d; cursor:pointer;" onclick="deleteNote(${n.id})"></i>
            </div>
        </div>
    `).join('');
}

// ==================== HEATMAP ====================
function initHeatmap() {
    const hm = document.getElementById('heatmap');
    if (!hm) return;
    hm.innerHTML = '';
    for (let i = 0; i < 28; i++) {
        const cell = document.createElement('div');
        cell.className = `cell ${Math.random() > 0.5 ? 'active' : ''}`;
        cell.title = `Day ${i+1}`;
        hm.appendChild(cell);
    }
}

// ==================== DAILY GOAL ====================
async function setDailyGoal() {
    const input = document.getElementById('goalInput');
    const val = parseInt(input.value);
    if (val > 0 && val <= 1440) {
        SKR.goal = val;
        document.getElementById('goalTarget').innerText = val;
        showToast(`🎯 Daily goal set to ${val} minutes`);
        await fetch('/api/update_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_goal', value: val })
        });
    } else {
        showToast('Please enter a valid number (1-1440)', true);
    }
}

// ==================== YOUTUBE MUSIC ====================
function loadYouTube() {
    const link = document.getElementById('ytLink').value;
    const container = document.getElementById('yt-player-container');
    const match = link.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (match) {
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${match[1]}?autoplay=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        showToast('🎵 Music loaded');
    } else {
        showToast('❌ Invalid YouTube URL', true);
    }
}

// ==================== ACHIEVEMENTS ====================
function renderAchievements() {
    const cont = document.getElementById('achievements-container');
    if (!cont) return;
    if (SKR.achievements.length === 0) {
        cont.innerHTML = '<p style="opacity:0.5;">No achievements yet. Keep going!</p>';
        return;
    }
    cont.innerHTML = SKR.achievements.slice(0,5).map(a => `
        <div class="achievement-item">
            <i class="fas fa-medal"></i> ${a.achievement_name}
            <small>${new Date(a.achieved_at).toLocaleDateString()}</small>
        </div>
    `).join('');
}

// ==================== RESET FOCUS COUNT ====================
async function resetFocusCount() {
    if (!confirm('Reset focus count to 0?')) return;
    const res = await fetch('/api/update_stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_focus' })
    });
    if (res.ok) {
        SKR.focusCount = 0;
        document.getElementById('focusCount').innerText = '0';
        showToast('✅ Focus count reset');
    } else {
        showToast('❌ Failed to reset', true);
    }
}

// ==================== LOGOUT ====================
document.getElementById('logout-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    showToast('👋 Logging out...');
    setTimeout(() => window.location.href = '/logout', 800);
});

// ==================== CONFETTI ====================
function confettiEffect() {
    if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } else {
        for (let i=0; i<30; i++) {
            setTimeout(() => {
                const c = document.createElement('div');
                c.style.cssText = `position:fixed; left:${Math.random()*100}%; top:-10px; width:8px; height:8px; background:hsl(${Math.random()*360},100%,70%); border-radius:50%; z-index:10002; animation:fall ${Math.random()*2+2}s linear;`;
                document.body.appendChild(c);
                setTimeout(() => c.remove(), 3000);
            }, i*50);
        }
    }
}

// Style cho confetti fallback
const style = document.createElement('style');
style.innerHTML = `@keyframes fall { to { transform: translateY(110vh) rotate(360deg); } }`;
document.head.appendChild(style);

// Export global functions
window.startTimer = startTimer;
window.pauseTimer = pauseTimer;
window.resetTimer = resetTimer;
window.toggleFocusMode = toggleFocusMode;
window.addNote = addNote;
window.toggleNote = toggleNote;
window.deleteNote = deleteNote;
window.setDailyGoal = setDailyGoal;
window.loadYouTube = loadYouTube;
window.resetFocusCount = resetFocusCount;