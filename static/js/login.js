// login.js
// DOM elements
const container = document.getElementById('mainContainer');
const signUpBtn = document.getElementById('signUpBtn');
const signInBtn = document.getElementById('signInBtn');
const regForm = document.getElementById('regForm');
const loginForm = document.getElementById('loginForm');
const toast = document.getElementById('toastMsg');

// Tạo mobile switch links nếu chưa có
function addMobileSwitches() {
    const signInForm = document.querySelector('.sign-in form');
    const signUpForm = document.querySelector('.sign-up form');

    if (signInForm && !document.querySelector('.sign-in .mobile-switch')) {
        const switchToSignUp = document.createElement('p');
        switchToSignUp.className = 'mobile-switch';
        switchToSignUp.innerHTML = 'Don\'t have an account? <a href="#" id="mobileSignUp">Sign Up</a>';
        signInForm.appendChild(switchToSignUp);
    }

    if (signUpForm && !document.querySelector('.sign-up .mobile-switch')) {
        const switchToSignIn = document.createElement('p');
        switchToSignIn.className = 'mobile-switch';
        switchToSignIn.innerHTML = 'Already have an account? <a href="#" id="mobileSignIn">Sign In</a>';
        signUpForm.appendChild(switchToSignIn);
    }

    // Gắn sự kiện cho mobile switch
    document.getElementById('mobileSignUp')?.addEventListener('click', (e) => {
        e.preventDefault();
        container.classList.add('active');
    });

    document.getElementById('mobileSignIn')?.addEventListener('click', (e) => {
        e.preventDefault();
        container.classList.remove('active');
    });
}

// ===== TOGGLE PANELS =====
signUpBtn.addEventListener('click', () => {
    container.classList.add('active');
    // Thêm hiệu ứng rung nhẹ khi chuyển (tùy chọn)
    container.style.animation = 'none';
    container.offsetHeight; // trigger reflow
    container.style.animation = 'containerAppear 0.8s ease-out';
});

signInBtn.addEventListener('click', () => {
    container.classList.remove('active');
    container.style.animation = 'none';
    container.offsetHeight;
    container.style.animation = 'containerAppear 0.8s ease-out';
});

// ===== HIỂN THỊ TOAST =====
function showToast(message, type = 'success', duration = 3000) {
    // Đảm bảo toast có icon phù hợp
    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    else if (type === 'warning') icon = 'fa-exclamation-triangle';
    else if (type === 'info') icon = 'fa-info-circle';
    
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
    toast.classList.add('show');
    toast.className = 'toast ' + type;
    
    // Thêm hiệu ứng rung nhẹ khi hiện
    toast.style.animation = 'toastPop 0.4s ease-out';
    setTimeout(() => {
        toast.style.animation = '';
    }, 400);
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// Thêm keyframes cho toast (nếu chưa có)
const style = document.createElement('style');
style.innerHTML = `
@keyframes toastPop {
    0% { transform: translateX(-50%) scale(0.8); opacity: 0; }
    50% { transform: translateX(-50%) scale(1.1); opacity: 1; }
    100% { transform: translateX(-50%) scale(1); opacity: 1; }
}
`;
document.head.appendChild(style);

// ===== XỬ LÝ ĐĂNG KÝ =====
regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signupBtn');
    btn.classList.add('loading');

    const formData = new FormData(regForm);
    
    // Validation cơ bản phía client
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    
    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        btn.classList.remove('loading');
        return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        showToast('Invalid email format', 'error');
        btn.classList.remove('loading');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        btn.classList.remove('loading');
        return;
    }

    try {
        const res = await fetch('/register', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        if (res.ok) {
            showToast('✅ Registration successful! Please login.', 'success');
            setTimeout(() => {
                container.classList.remove('active'); // quay về sign-in
                regForm.reset();
            }, 1500);
        } else {
            showToast('❌ ' + (data.error || 'Registration failed'), 'error');
        }
    } catch (err) {
        showToast('❌ Cannot connect to server', 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

// ===== XỬ LÝ ĐĂNG NHẬP =====
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.classList.add('loading');

    const formData = new FormData(loginForm);
    
    const email = formData.get('email');
    const password = formData.get('password');
    
    if (!email || !password) {
        showToast('Please fill all fields', 'error');
        btn.classList.remove('loading');
        return;
    }

    try {
        const res = await fetch('/login', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        if (res.ok) {
            showToast('🎉 Login successful! Redirecting...', 'success');
            // Hiệu ứng fade out trước khi chuyển trang
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            showToast('❌ ' + (data.error || 'Invalid credentials'), 'error');
        }
    } catch (err) {
        showToast('❌ Network error', 'error');
    } finally {
        btn.classList.remove('loading');
    }
});

// Khởi tạo mobile switches
addMobileSwitches();

// Thêm hiệu ứng focus cho input
const inputs = document.querySelectorAll('.input-group input');
inputs.forEach(input => {
    input.addEventListener('focus', () => {
        input.parentElement.style.transform = 'scale(1.02)';
    });
    input.addEventListener('blur', () => {
        input.parentElement.style.transform = 'scale(1)';
    });
});

// Thêm hiệu ứng hover cho nút ghost
const ghostBtns = document.querySelectorAll('.ghost');
ghostBtns.forEach(btn => {
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
    });
});

// Thêm hiệu ứng ripple cho nút action (tùy chọn)
const actionBtns = document.querySelectorAll('.action-btn');
actionBtns.forEach(btn => {
    btn.addEventListener('click', function(e) {
        let x = e.clientX - e.target.getBoundingClientRect().left;
        let y = e.clientY - e.target.getBoundingClientRect().top;
        let ripple = document.createElement('span');
        ripple.style.position = 'absolute';
        ripple.style.width = '0px';
        ripple.style.height = '0px';
        ripple.style.backgroundColor = 'rgba(255,255,255,0.5)';
        ripple.style.borderRadius = '50%';
        ripple.style.transform = 'translate(-50%, -50%)';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        ripple.style.transition = 'width 0.5s, height 0.5s, opacity 0.5s';
        ripple.style.pointerEvents = 'none';
        this.appendChild(ripple);
        setTimeout(() => {
            ripple.style.width = '300px';
            ripple.style.height = '300px';
            ripple.style.opacity = '0';
        }, 10);
        setTimeout(() => {
            ripple.remove();
        }, 500);
    });
});

console.log('SKR-HUB Login ready with premium effects!');