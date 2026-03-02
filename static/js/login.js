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
});

signInBtn.addEventListener('click', () => {
    container.classList.remove('active');
});

// ===== HIỂN THỊ TOAST =====
function showToast(message, type = 'success', duration = 3000) {
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${message}`;
    toast.classList.add('show');
    toast.className = 'toast ' + type;
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

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