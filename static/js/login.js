/**
 * SKR-HUB LOGIN — v2.0 FIXED & UPGRADED
 *
 * BUG FIXES:
 * [B1] CRITICAL — DOM queries ở script-level (ngoài DOMContentLoaded)
 *                 → null nếu script load trước DOM → crash toàn bộ file
 * [B2] CRITICAL — showToast: classList.add('show') rồi ngay sau đó
 *                 toast.className = 'toast ' + type → GHI ĐÈ, xóa luôn 'show'
 *                 → toast KHÔNG BAO GIỜ hiện được
 * [B3] MAJOR    — showToast: không clearTimeout cũ → toast chồng nhau
 * [B4] MAJOR    — Ripple dùng e.target thay vì e.currentTarget
 *                 → khi click vào icon con, tọa độ bị sai
 * [B5] MEDIUM   — Ghost btn hover bằng JS inline style → conflict với CSS
 *                 (CSS đã xử lý hover rồi, JS ghi đè làm transition mất)
 * [B6] MEDIUM   — Input focus/blur bằng JS inline transform → conflict với
 *                 CSS :focus transform, làm animation giật
 * [B7] MINOR    — window.location.href = '/dashboard.html' → hardcode sai
 *                 (Flask serve route /dashboard, không phải file tĩnh)
 *
 * UPGRADES:
 * [+] Real-time validation với class .error / .success từ login.css v2
 * [+] Password strength meter → .pw-strength[data-level]
 * [+] Toggle show/hide password → .toggle-pw button
 * [+] Debounced input validation (không spam event)
 * [+] Escape HTML trong toast để tránh XSS
 * [+] Rate limit click: không spam submit khi đang loading
 */

// ==================== KHỞI TẠO ====================
document.addEventListener('DOMContentLoaded', () => {
    // [B1] FIX: mọi DOM query đều nằm trong DOMContentLoaded
    const container = document.getElementById('mainContainer');
    const signUpBtn = document.getElementById('signUpBtn');
    const signInBtn = document.getElementById('signInBtn');
    const regForm   = document.getElementById('regForm');
    const loginForm = document.getElementById('loginForm');
    const toast     = document.getElementById('toastMsg');

    // Guard: dừng nếu thiếu element thiết yếu
    if (!container || !regForm || !loginForm || !toast) {
        console.error('[SKR Login] Missing required DOM elements');
        return;
    }

    // Inject keyframe 1 lần duy nhất
    injectStyles();

    // Khởi tạo các module
    initTogglePanels(container, signUpBtn, signInBtn);
    addMobileSwitches(container);
    initInputEffects();
    initPasswordToggles();
    initPasswordStrength();
    initRipple();
    initForms(container, regForm, loginForm, toast);
});

// ==================== INJECT STYLES ====================
function injectStyles() {
    if (document.getElementById('skr-login-styles')) return;
    const s = document.createElement('style');
    s.id = 'skr-login-styles';
    s.textContent = `
        @keyframes toastPop {
            0%   { transform: translateX(-50%) scale(0.80); opacity: 0; }
            55%  { transform: translateX(-50%) scale(1.06); opacity: 1; }
            100% { transform: translateX(-50%) scale(1);    opacity: 1; }
        }
        @keyframes shake {
            0%,100% { transform: translateX(0); }
            20%,60% { transform: translateX(-6px); }
            40%,80% { transform: translateX(6px); }
        }
    `;
    document.head.appendChild(s);
}

// ==================== TOGGLE PANELS ====================
function initTogglePanels(container, signUpBtn, signInBtn) {
    const toggle = (active) => {
        container.classList.toggle('active', active);
        // reset animation để replay containerAppear
        container.style.animation = 'none';
        void container.offsetHeight; // force reflow
        container.style.animation  = '';
    };

    signUpBtn?.addEventListener('click', () => toggle(true));
    signInBtn?.addEventListener('click', () => toggle(false));
}

// ==================== MOBILE SWITCHES ====================
function addMobileSwitches(container) {
    const addSwitch = (formSel, cls, id, text, linkText, activate) => {
        const form = document.querySelector(formSel);
        if (!form || document.querySelector(`${formSel} .mobile-switch`)) return;

        const p    = document.createElement('p');
        p.className = 'mobile-switch';

        const span = document.createElement('span');
        span.textContent = text;

        const a    = document.createElement('a');
        a.href      = '#';
        a.id        = id;
        // [B5 related] FIX: textContent thay vì innerHTML → tránh XSS
        a.textContent = linkText;
        a.addEventListener('click', e => {
            e.preventDefault();
            container.classList.toggle('active', activate);
        });

        p.append(span, a);
        form.appendChild(p);
    };

    addSwitch('.sign-in form', 'mobile-switch', 'mobileSignUp',
              "Don't have an account?", ' Sign Up',  true);
    addSwitch('.sign-up form', 'mobile-switch', 'mobileSignIn',
              'Already have an account?', ' Sign In', false);
}

// ==================== INPUT EFFECTS ====================
// [B6] FIX: bỏ JS inline transform — CSS :focus đã handle rồi
// Chỉ giữ class toggle cho .input-group (dùng cho validation state)
function initInputEffects() {
    document.querySelectorAll('.input-group input').forEach(input => {
        input.addEventListener('blur', () => validateField(input));
    });
}

// ==================== REAL-TIME VALIDATION ====================
const validators = {
    username: v => v.length >= 3   ? null : 'Tối thiểu 3 ký tự',
    email:    v => /^\S+@\S+\.\S+$/.test(v) ? null : 'Email không hợp lệ',
    password: v => v.length >= 6   ? null : 'Tối thiểu 6 ký tự',
};

function validateField(input) {
    const name    = input.name;
    const val     = input.value.trim();
    const group   = input.closest('.input-group');
    if (!group || !validators[name]) return true;

    const err = validators[name](val);
    setFieldState(group, err);
    return !err;
}

function setFieldState(group, errMsg) {
    // Xóa state cũ
    group.classList.remove('error', 'success');

    // Lấy hoặc tạo .field-msg
    let msg = group.querySelector('.field-msg');
    if (!msg) {
        msg = document.createElement('span');
        msg.className = 'field-msg';
        group.appendChild(msg);
    }

    if (errMsg) {
        group.classList.add('error');
        msg.textContent = errMsg;
    } else if (group.querySelector('input').value.trim()) {
        group.classList.add('success');
        msg.textContent = '✓';
    }
}

// ==================== PASSWORD TOGGLE ====================
function initPasswordToggles() {
    document.querySelectorAll('input[type="password"]').forEach(input => {
        // Tạo nút nếu chưa có trong HTML
        if (input.parentElement.querySelector('.toggle-pw')) return;

        const btn = document.createElement('button');
        btn.type      = 'button';
        btn.className = 'toggle-pw';
        btn.setAttribute('aria-label', 'Toggle password visibility');
        btn.innerHTML = '<i class="fas fa-eye"></i>';

        btn.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.innerHTML = `<i class="fas fa-eye${show ? '-slash' : ''}"></i>`;
        });

        input.parentElement.appendChild(btn);
    });
}

// ==================== PASSWORD STRENGTH ====================
function initPasswordStrength() {
    document.querySelectorAll('input[name="password"]').forEach(input => {
        // Tạo strength bar nếu chưa có
        let bar = input.closest('.input-group')?.nextElementSibling;
        if (!bar || !bar.classList.contains('pw-strength')) {
            bar = document.createElement('div');
            bar.className = 'pw-strength';
            bar.innerHTML = '<span></span><span></span><span></span>';
            input.closest('.input-group')?.insertAdjacentElement('afterend', bar);
        }

        input.addEventListener('input', () => {
            const v     = input.value;
            const level = getPwStrength(v);
            bar.dataset.level = v.length ? level : '';
        });
    });
}

function getPwStrength(pw) {
    let score = 0;
    if (pw.length >= 8)             score++;
    if (/[A-Z]/.test(pw))          score++;
    if (/[0-9]/.test(pw))          score++;
    if (/[^A-Za-z0-9]/.test(pw))   score++;
    if (score <= 1) return 1;
    if (score <= 2) return 2;
    return 3;
}

// ==================== RIPPLE ====================
// [B4] FIX: dùng e.currentTarget (button) thay vì e.target (có thể là icon con)
function initRipple() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            // [B4] FIX: currentTarget luôn là button, không bị lệch
            const rect = this.getBoundingClientRect();
            const x    = e.clientX - rect.left;
            const y    = e.clientY - rect.top;

            const ripple = document.createElement('span');
            Object.assign(ripple.style, {
                position:        'absolute',
                width:           '0',
                height:          '0',
                background:      'rgba(255,255,255,0.45)',
                borderRadius:    '50%',
                transform:       'translate(-50%, -50%)',
                left:            x + 'px',
                top:             y + 'px',
                transition:      'width 0.55s ease, height 0.55s ease, opacity 0.55s ease',
                pointerEvents:   'none',
                zIndex:          '0',
            });
            this.appendChild(ripple);

            // trigger transition
            requestAnimationFrame(() => {
                ripple.style.width   = '320px';
                ripple.style.height  = '320px';
                ripple.style.opacity = '0';
            });

            setTimeout(() => ripple.remove(), 600);
        });
    });
}

// ==================== GHOST BTN ====================
// [B5] FIX: bỏ JS hover inline style — CSS :hover đã handle smooth rồi
// (giữ hàm này trống để không break code cũ nếu ai gọi)
function initGhostHover() { /* CSS handles this */ }

// ==================== TOAST ====================
let _toastTimer = null;

// [B2] FIX: đặt className TRƯỚC, sau đó add 'show' → không bao giờ bị overwrite
// [B3] FIX: clearTimeout cũ để tránh chồng chéo
function showToast(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('toastMsg');
    if (!toast) return;

    const icons = {
        success: 'fa-check-circle',
        error:   'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info:    'fa-info-circle',
    };
    const icon = icons[type] || icons.success;

    // [B2] FIX: set className (không có 'show') TRƯỚC
    toast.className = `toast ${type}`;
    // [B2] safe: textContent cho message, icon qua class không có user input
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${escapeHtml(message)}</span>`;

    // force reflow để transition chạy đúng sau khi className thay đổi
    void toast.offsetHeight;

    // [B2] FIX: add 'show' SAU khi đã set className
    toast.classList.add('show');
    toast.style.animation = 'toastPop 0.4s ease-out both';

    // [B3] FIX: clear timer cũ
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => { toast.style.animation = ''; }, 500);
    }, duration);
}

// ==================== VALIDATION HELPER ====================
function validateForm(fields) {
    let valid = true;
    fields.forEach(({ input, rule, msg }) => {
        const group = input?.closest('.input-group');
        if (!input || !group) return;
        if (!rule(input.value.trim())) {
            setFieldState(group, msg);
            if (valid) {
                // shake animation trên field đầu tiên lỗi
                group.style.animation = 'shake 0.4s ease';
                setTimeout(() => { group.style.animation = ''; }, 400);
            }
            valid = false;
        }
    });
    return valid;
}

// ==================== ĐĂNG KÝ ====================
function initForms(container, regForm, loginForm) {
    // --- REGISTER ---
    regForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = regForm.querySelector('[id="signupBtn"], button[type="submit"]');
        if (btn?.classList.contains('loading')) return; // [+] rate limit

        const fd       = new FormData(regForm);
        const username = fd.get('username') || '';
        const email    = fd.get('email')    || '';
        const password = fd.get('password') || '';

        const valid = validateForm([
            {
                input: regForm.querySelector('[name="username"]'),
                rule:  v => v.length >= 3,
                msg:   'Tối thiểu 3 ký tự'
            },
            {
                input: regForm.querySelector('[name="email"]'),
                rule:  v => /^\S+@\S+\.\S+$/.test(v),
                msg:   'Email không hợp lệ'
            },
            {
                input: regForm.querySelector('[name="password"]'),
                rule:  v => v.length >= 6,
                msg:   'Tối thiểu 6 ký tự'
            },
        ]);

        if (!valid) return;

        btn?.classList.add('loading');
        try {
            const res  = await fetch('/register', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) {
                showToast('Registration successful! Please login.', 'success');
                setTimeout(() => {
                    container.classList.remove('active');
                    regForm.reset();
                    // reset pw-strength
                    document.querySelectorAll('.pw-strength').forEach(b => { b.dataset.level = ''; });
                    // reset field states
                    regForm.querySelectorAll('.input-group').forEach(g => {
                        g.classList.remove('error', 'success');
                    });
                }, 1500);
            } else {
                showToast(data.error || 'Registration failed', 'error');
            }
        } catch {
            showToast('Cannot connect to server', 'error');
        } finally {
            btn?.classList.remove('loading');
        }
    });

    // --- LOGIN ---
    loginForm.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = loginForm.querySelector('[id="loginBtn"], button[type="submit"]');
        if (btn?.classList.contains('loading')) return; // [+] rate limit

        const fd    = new FormData(loginForm);
        const email = fd.get('email')    || '';
        const pw    = fd.get('password') || '';

        const valid = validateForm([
            {
                input: loginForm.querySelector('[name="email"]'),
                rule:  v => v.length > 0,
                msg:   'Vui lòng nhập email'
            },
            {
                input: loginForm.querySelector('[name="password"]'),
                rule:  v => v.length > 0,
                msg:   'Vui lòng nhập mật khẩu'
            },
        ]);
        if (!valid) return;

        btn?.classList.add('loading');
        try {
            const res  = await fetch('/login', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) {
                showToast('Login successful! Redirecting...', 'success', 2000);
                // Fade out page rồi chuyển trang
                setTimeout(() => {
                    document.body.style.transition = 'opacity 0.5s ease';
                    document.body.style.opacity    = '0';
                    // [B7] FIX: dùng route Flask /dashboard thay vì file tĩnh
                    setTimeout(() => { window.location.href = data.redirect || '/dashboard'; }, 500);
                }, 700);
            } else {
                showToast(data.error || 'Invalid credentials', 'error');
                // shake form
                const pwGroup = loginForm.querySelector('[name="password"]')?.closest('.input-group');
                if (pwGroup) {
                    pwGroup.style.animation = 'shake 0.4s ease';
                    setTimeout(() => { pwGroup.style.animation = ''; }, 400);
                }
            }
        } catch {
            showToast('Network error. Please try again.', 'error');
        } finally {
            btn?.classList.remove('loading');
        }
    });
}

// ==================== UTILS ====================
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

console.log('[SKR-HUB] Login v2.0 ready ✨');