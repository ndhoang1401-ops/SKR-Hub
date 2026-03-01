// DOM elements
const container = document.getElementById('mainContainer');
const signUpBtn = document.getElementById('signUpBtn');
const signInBtn = document.getElementById('signInBtn');
const regForm = document.getElementById('regForm');
const loginForm = document.getElementById('loginForm');
const toast = document.getElementById('toastMsg');

// ===== TOGGLE PANELS =====
signUpBtn.addEventListener('click', () => {
    container.classList.add('active');
    // Thêm hiệu ứng nhẹ cho container (tùy chọn)
});

signInBtn.addEventListener('click', () => {
    container.classList.remove('active');
});

// ===== HIỂN THỊ TOAST =====
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.add('show');
    if (isError) toast.classList.add('error');
    else toast.classList.remove('error');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
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
        showToast('Tên người dùng phải có ít nhất 3 ký tự', true);
        btn.classList.remove('loading');
        return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(email)) {
        showToast('Email không hợp lệ', true);
        btn.classList.remove('loading');
        return;
    }
    
    if (password.length < 6) {
        showToast('Mật khẩu phải có ít nhất 6 ký tự', true);
        btn.classList.remove('loading');
        return;
    }

    try {
        const res = await fetch('/register', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            showToast('✅ Đăng ký thành công! Vui lòng đăng nhập.');
            setTimeout(() => {
                container.classList.remove('active'); // quay về sign-in
                regForm.reset(); // reset form
            }, 1500);
        } else {
            const err = await res.text();
            showToast('❌ Lỗi: ' + err, true);
        }
    } catch (err) {
        showToast('❌ Không thể kết nối server', true);
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
    
    // Validation cơ bản
    const email = formData.get('email');
    const password = formData.get('password');
    
    if (!email || !password) {
        showToast('Vui lòng nhập đầy đủ thông tin', true);
        btn.classList.remove('loading');
        return;
    }

    try {
        const res = await fetch('/login', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            showToast('🎉 Đăng nhập thành công! Đang chuyển hướng...');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 1000);
        } else {
            const err = await res.text();
            showToast('❌ ' + err, true);
        }
    } catch (err) {
        showToast('❌ Lỗi kết nối server', true);
    } finally {
        btn.classList.remove('loading');
    }
});

// ===== HIỆU ỨNG GÕ CHỮ CHO PLACEHOLDER (TÙY CHỌN) =====
// Không cần thiết, nhưng nếu muốn thêm chút "hay ho"
console.log('SKR-HUB Login ready');