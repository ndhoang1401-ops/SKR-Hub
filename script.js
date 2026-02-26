/* =========================
   CEMS AUTH SYSTEM v6.0 STABLE+
   Clean • Safe • No Crash • Dashboard Ready
   ========================= */

"use strict";

/* =========================
   SAFE ELEMENT GETTER
   ========================= */

function $(id){
    return document.getElementById(id);
}

function $all(selector){
    return document.querySelectorAll(selector);
}

/* =========================
   CONFIG
   ========================= */

const SESSION_DURATION = 2 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 30 * 1000;

/* =========================
   STORAGE
   ========================= */

function getUsers(){
    return JSON.parse(localStorage.getItem("chemUsers")) || [];
}

function saveUsers(users){
    localStorage.setItem("chemUsers", JSON.stringify(users));
}

function setSession(user){
    const session = {
        user,
        expires: Date.now() + SESSION_DURATION
    };
    localStorage.setItem("chemSession", JSON.stringify(session));
}

function clearSession(){
    localStorage.removeItem("chemSession");
}

function getSession(){
    const session = JSON.parse(localStorage.getItem("chemSession"));
    if(!session) return null;

    if(Date.now() > session.expires){
        clearSession();
        return null;
    }

    return session.user;
}

/* =========================
   VALIDATION
   ========================= */

function isValidEmail(email){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password){
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password);
}

async function hashPassword(password){
    const data = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2,"0"))
        .join("");
}

/* =========================
   UI HELPERS
   ========================= */

function setLoading(btn,state){
    if(!btn) return;
    if(state){
        btn.dataset.text = btn.innerText;
        btn.innerText = "Processing...";
        btn.disabled = true;
    } else {
        btn.innerText = btn.dataset.text;
        btn.disabled = false;
    }
}

function shake(el){
    if(!el) return;
    el.classList.add("shake");
    setTimeout(()=>el.classList.remove("shake"),500);
}

/* =========================
   AUTO REDIRECT SAFE
   ========================= */

window.addEventListener("DOMContentLoaded",()=>{

    const user = getSession();
    const path = window.location.pathname;

    if(path.includes("dashboard.html")){
        if(!user){
            window.location.href = "index.html";
            return;
        }

        // SHOW USER NAME IF EXISTS
        const nameEl = $("userName");
        if(nameEl) nameEl.innerText = user.name;
    }

    if(path.includes("index.html")){
        if(user){
            window.location.href = "dashboard.html";
            return;
        }
    }

});

/* =========================
   TOGGLE LOGIN / REGISTER
   ========================= */

$("register")?.addEventListener("click",()=>{
    $("container")?.classList.add("active");
});

$("login")?.addEventListener("click",()=>{
    $("container")?.classList.remove("active");
});

/* =========================
   REGISTER
   ========================= */

$("signUpForm")?.addEventListener("submit", async e=>{
    e.preventDefault();

    const name = $("regName")?.value.trim();
    const email = $("regEmail")?.value.trim().toLowerCase();
    const password = $("regPassword")?.value;

    if(!name || name.length < 3) return shake($("signUpForm"));
    if(!isValidEmail(email)) return shake($("signUpForm"));
    if(!isStrongPassword(password)) return shake($("signUpForm"));

    const users = getUsers();
    if(users.find(u=>u.email === email)) return shake($("signUpForm"));

    const btn = $("signUpForm").querySelector("button");
    setLoading(btn,true);

    const hashed = await hashPassword(password);

    users.push({
        id: crypto.randomUUID(),
        name,
        email,
        password: hashed,
        createdAt: new Date().toISOString(),
        role: "student",
        level: 1,
        points: 0
    });

    saveUsers(users);

    setTimeout(()=>{
        setLoading(btn,false);
        $("signUpForm").reset();
        $("container")?.classList.remove("active");
    },600);
});

/* =========================
   LOGIN
   ========================= */

let loginAttempts = 0;
let lockUntil = 0;

$("signInForm")?.addEventListener("submit", async e=>{
    e.preventDefault();

    if(Date.now() < lockUntil){
        return shake($("signInForm"));
    }

    const email = $("loginEmail")?.value.trim().toLowerCase();
    const password = $("loginPassword")?.value;

    const users = getUsers();
    const hashed = await hashPassword(password);

    const user = users.find(u=>u.email === email && u.password === hashed);

    if(user){
        loginAttempts = 0;
        setSession(user);

        const btn = $("signInForm").querySelector("button");
        setLoading(btn,true);

        setTimeout(()=>{
            window.location.href = "dashboard.html";
        },600);

    } else {
        loginAttempts++;
        shake($("signInForm"));

        if(loginAttempts >= MAX_LOGIN_ATTEMPTS){
            lockUntil = Date.now() + LOCK_TIME;
            loginAttempts = 0;
        }
    }
});

/* =========================
   LOGOUT
   ========================= */

$("logoutBtn")?.addEventListener("click",()=>{
    clearSession();
    window.location.href = "index.html";
});

/* =========================
   FLASHCARD SAFE
   ========================= */

$all(".flashcard").forEach(card=>{
    card.addEventListener("click",()=>{
        card.classList.toggle("flip");

        // reward system
        const session = getSession();
        if(!session) return;

        const users = getUsers();
        const userIndex = users.findIndex(u=>u.id===session.id);

        if(userIndex !== -1){
            users[userIndex].points += 5;
            if(users[userIndex].points >= 100){
                users[userIndex].level++;
                users[userIndex].points = 0;
            }
            saveUsers(users);
            setSession(users[userIndex]);
        }
    });
});

/* =========================
   SESSION COUNTDOWN (VIP)
   ========================= */

setInterval(()=>{
    const session = JSON.parse(localStorage.getItem("chemSession"));
    if(!session) return;

    const remaining = session.expires - Date.now();
    const timerEl = $("sessionTimer");

    if(timerEl && remaining > 0){
        const min = Math.floor(remaining/60000);
        const sec = Math.floor((remaining%60000)/1000);
        timerEl.innerText = `${min}:${sec.toString().padStart(2,"0")}`;
    }

    if(remaining <= 0){
        clearSession();
        window.location.href = "index.html";
    }

},1000);