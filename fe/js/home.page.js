/**
 * fe/home.page.js
 * Home Screen (geschützt).
 * - Lädt Userdaten via /api/auth/me
 * - Zeigt Avatar, DisplayName, Points
 */

import { me, getToken, clearToken } from "./auth.js";

const userPill = document.getElementById("userPill");
const pointPill = document.getElementById("pointPill");
const userAvatarImg = document.getElementById("userAvatarImg");
const userAvatarFallback = document.getElementById("userAvatarFallback");

const homeMsg = document.getElementById("homeMsg");
const logoutBtn = document.getElementById("logoutBtn");

function setMsg(type, text) {
    homeMsg.className = `toast ${type}`;
    homeMsg.textContent = text;
    homeMsg.style.display = "block";
}

function renderTopbarAvatar(u) {
    const initial = (u?.displayName?.[0] || u?.email?.[0] || "?").toUpperCase();

    userAvatarFallback.textContent = initial;
    userAvatarFallback.style.display = "block";
    userAvatarImg.style.display = "none";

    if (!u?.avatarUrl) return;

    userAvatarImg.onload = () => {
        userAvatarImg.style.display = "block";
        userAvatarFallback.style.display = "none";
    };

    userAvatarImg.onerror = () => {
        userAvatarImg.style.display = "none";
        userAvatarFallback.style.display = "block";
    };

    userAvatarImg.src = u.avatarUrl;
}


async function init() {
    if (!getToken()) {
        window.location.replace("/index.html");
        return;
    }

    try {
        const data = await me();
        const u = data.user || {};

        userPill.textContent = u.displayName || u.email || "Eingeloggt";
        pointPill.textContent = `⭐ ${u.points ?? 0}`;

        renderTopbarAvatar(u);
    } catch (err) {
        console.error("HOME init error:", err);

        if (err?.status === 401) {
            clearToken();
            setMsg("error", "Session ungültig. Bitte erneut einloggen.");
            setTimeout(() => window.location.replace("/index.html"), 600);
            return;
        }

        setMsg("error", err?.message || "Fehler beim Laden.");
    }
}

logoutBtn?.addEventListener("click", () => {
    clearToken();
    window.location.replace("/index.html");
});

init();
