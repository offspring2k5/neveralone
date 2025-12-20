/**
 * fe/profile.page.js
 * Profilseite:
 * - Userdaten anzeigen (/me)
 * - Name ändern (PATCH /api/auth/profile) [optional Richtung FR21]
 * - Avatar hochladen (POST /api/auth/avatar)
 */

import { me, getToken, clearToken } from "./auth.js";
import { patchJson } from "./api.js";

const pName = document.getElementById("pName");
const pEmail = document.getElementById("pEmail");
const pCreatedAt = document.getElementById("pCreatedAt");

const profileMsg = document.getElementById("profileMsg");
const logoutBtn = document.getElementById("logoutBtn");

const nameForm = document.getElementById("nameForm");
const newName = document.getElementById("newName");

const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const avatarForm = document.getElementById("avatarForm");
const avatarFile = document.getElementById("avatarFile");

let currentUser = null; // <- damit wir email/displayName auch später haben

function setMsg(type, text) {
    profileMsg.className = `toast ${type}`;
    profileMsg.textContent = text;
    profileMsg.style.display = "block";
}

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("de-AT");
    } catch {
        return iso;
    }
}

/**
 * Avatar Renderer:
 * - Wenn avatarUrl vorhanden: Bild anzeigen
 * - Sonst: Initiale anzeigen (1. Buchstabe)
 */
function renderAvatar(u) {
    const initial = (u?.displayName?.[0] || u?.email?.[0] || "?").toUpperCase();

    // ✅ immer sofort Initiale anzeigen
    avatarFallback.textContent = initial;
    avatarFallback.style.display = "block";
    avatarImg.style.display = "none";

    // kein avatarUrl -> fertig
    if (!u?.avatarUrl) return;

    // ✅ Bild nur einblenden, wenn es wirklich lädt
    avatarImg.onload = () => {
        avatarImg.style.display = "block";
        avatarFallback.style.display = "none";
    };
    avatarImg.onerror = () => {
        avatarImg.style.display = "none";
        avatarFallback.style.display = "block";
    };

    avatarImg.src = u.avatarUrl;
}

async function loadProfile() {
    if (!getToken()) {
        window.location.replace("/index.html");
        return;
    }

    try {
        const data = await me();
        const u = data.user || {};
        currentUser = u;

        pName.textContent = u.displayName ?? "—";
        pEmail.textContent = u.email ?? "—";
        pCreatedAt.textContent = formatDate(u.createdAt);

        newName.value = u.displayName ?? "";

        renderAvatar(u);
    } catch (err) {
        console.error("PROFILE load error:", err);

        if (err?.status === 401) {
            clearToken();
            setMsg("error", "Session ungültig. Bitte erneut einloggen.");
            setTimeout(() => window.location.replace("/index.html"), 600);
            return;
        }

        setMsg("error", err?.message || "Fehler beim Laden des Profils.");
    }
}

logoutBtn?.addEventListener("click", () => {
    clearToken();
    window.location.replace("/index.html");
});

nameForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getToken();
    if (!token) return window.location.replace("/index.html");

    const displayName = newName.value.trim();
    if (displayName.length < 2) {
        setMsg("error", "Name muss mindestens 2 Zeichen haben.");
        return;
    }

    try {
        const data = await patchJson(
            "/api/auth/profile",
            { displayName },
            { Authorization: `Bearer ${token}` }
        );

        const newDisplayName = data.user?.displayName ?? displayName;

        // UI + Cache updaten
        pName.textContent = newDisplayName;
        newName.value = newDisplayName;

        currentUser = {
            ...(currentUser || {}),
            displayName: newDisplayName,
        };

        //Initiale sofort updaten (Avatar wird nur gezeigt wenn er lädt)
        renderAvatar(currentUser);

        setMsg("ok", "Name gespeichert.");
    } catch (err) {
        console.error("PROFILE patch error:", err);

        if (err?.status === 401) {
            clearToken();
            setMsg("error", "Session ungültig. Bitte erneut einloggen.");
            setTimeout(() => window.location.replace("/index.html"), 600);
            return;
        }

        setMsg("error", err?.message || "Fehler beim Speichern.");
    }
});


avatarForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getToken();
    if (!token) return window.location.replace("/index.html");

    const file = avatarFile.files?.[0];
    if (!file) return setMsg("error", "Bitte eine Datei auswählen.");

    const fd = new FormData();
    fd.append("avatar", file);

    try {
        const res = await fetch("/api/auth/avatar", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = new Error(data?.error || `HTTP ${res.status}`);
            err.status = res.status;
            throw err;
        }

        if (data.user?.avatarUrl) {
            // cache update + cache-bust
            const url = data.user.avatarUrl + `?v=${Date.now()}`;
            currentUser = { ...(currentUser || {}), avatarUrl: url };
            renderAvatar(currentUser);
        }

        avatarFile.value = "";
        setMsg("ok", "Avatar gespeichert.");
    } catch (err) {
        console.error("AVATAR upload error:", err);

        if (err?.status === 401) {
            clearToken();
            setMsg("error", "Session ungültig. Bitte erneut einloggen.");
            setTimeout(() => window.location.replace("/index.html"), 600);
            return;
        }

        setMsg("error", err?.message || "Fehler beim Avatar-Upload.");
    }
});

loadProfile();
