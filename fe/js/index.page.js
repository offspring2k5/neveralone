/**
 * fe/index.page.js
 * Login/Register UI
 * - UI logic only (no fetch here -> auth.js)
 */

import { login, register } from "./auth.js";

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginMsg = document.getElementById("loginMsg");
const registerMsg = document.getElementById("registerMsg");

function setMsg(el, type, text) {
    el.className = `toast ${type}`;
    el.textContent = text;
    el.style.display = "block";
}

function clearMsg(el) {
    el.style.display = "none";
    el.textContent = "";
    el.className = "toast";
}

/* Hidden forms must be disabled, otherwise required fields will block form submission */
function setEnabled(form, enabled) {
    form.querySelectorAll("input, button, select, textarea").forEach((el) => {
        el.disabled = !enabled;
    });
}

function switchTab(mode) {
    const isLogin = mode === "login";

    tabLogin.classList.toggle("active", isLogin);
    tabRegister.classList.toggle("active", !isLogin);
    tabLogin.setAttribute("aria-selected", String(isLogin));
    tabRegister.setAttribute("aria-selected", String(!isLogin));

    loginForm.style.display = isLogin ? "grid" : "none";
    registerForm.style.display = !isLogin ? "grid" : "none";

    setEnabled(loginForm, isLogin);
    setEnabled(registerForm, !isLogin);

    clearMsg(loginMsg);
    clearMsg(registerMsg);
}

tabLogin.addEventListener("click", () => switchTab("login"));
tabRegister.addEventListener("click", () => switchTab("register"));

/* Login */
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(loginMsg);

    try {
        const email = document.getElementById("logEmail").value.trim();
        const password = document.getElementById("logPw").value;

        await login(email, password);

        setMsg(loginMsg, "ok", "Login erfolgreich. Weiterleitung…");
        window.location.href = "/home.html";
    } catch (err) {
        setMsg(loginMsg, "error", err.message);
    }
});

/* FR4: Register */
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg(registerMsg);

    try {
        const displayName = document.getElementById("userName").value.trim();
        const email = document.getElementById("regEmail").value.trim();
        const password = document.getElementById("regPw").value;
        const password2 = document.getElementById("regPw2").value;

        if (password !== password2) {
            setMsg(registerMsg, "error", "Passwörter stimmen nicht überein.");
            return;
        }

        await register(email, password, displayName);

        setMsg(registerMsg, "ok", "Account erstellt. Du kannst dich jetzt einloggen.");

        // empty input
        document.getElementById("userName").value = "";
        document.getElementById("regEmail").value = "";
        document.getElementById("regPw").value = "";
        document.getElementById("regPw2").value = "";

        // directly back to login
        switchTab("login");
        document.getElementById("logEmail").value = email;
        document.getElementById("logPw").value = "";
    } catch (err) {
        setMsg(registerMsg, "error", err.message);
    }
});

// Initial
switchTab("login");
