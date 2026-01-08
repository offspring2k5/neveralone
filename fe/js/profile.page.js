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
const slot1 = document.getElementById("slot1");
const slot2 = document.getElementById("slot2");
const emojiGrid = document.getElementById("emojiGrid");
const mashupPreview = document.getElementById("mashupPreview");
const mashupPlaceholder = document.getElementById("mashupPlaceholder");
const saveMashupBtn = document.getElementById("saveMashupBtn");

// --- EMOJI LIST (Common supported emojis) ---
const EMOJIS = [
    "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊","💋","💌","💘","💝","💖","💗","💓","💞","💕","💟","❣️","💔","❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💯","💢","💥","💫","💦","💨","🕳️","💣","💬","👁️‍🗨️","🗨️","🗯️","💭","💤"
];
let currentUser = null; // <- damit wir email/displayName auch später haben

let selection = {
    left: "😀",
    right: null,
    activeSlot: 1 // 1 or 2
};

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

function initEmojiKitchen() {
    // 1. Render Grid
    emojiGrid.innerHTML = "";
    EMOJIS.forEach(emoji => {
        const btn = document.createElement("div");
        btn.className = "emoji-btn";
        btn.textContent = emoji;
        btn.onclick = () => selectEmoji(emoji);
        emojiGrid.appendChild(btn);
    });

    // 2. Slot Click Handlers
    slot1.onclick = () => setActiveSlot(1);
    slot2.onclick = () => setActiveSlot(2);

    // 3. Initial State
    updateKitchenUI();
}

function setActiveSlot(num) {
    selection.activeSlot = num;
    updateKitchenUI();
}

function selectEmoji(emoji) {
    if (selection.activeSlot === 1) {
        selection.left = emoji;
        // Auto-advance to slot 2 if it's empty
        if (!selection.right) selection.activeSlot = 2;
    } else {
        selection.right = emoji;
    }
    updateKitchenUI();
    updatePreview();
}

function updateKitchenUI() {
    // Update Slots Visuals
    slot1.textContent = selection.left || "?";
    slot2.textContent = selection.right || "?";

    if (selection.activeSlot === 1) {
        slot1.classList.add("selected");
        slot2.classList.remove("selected");
    } else {
        slot1.classList.remove("selected");
        slot2.classList.add("selected");
    }
}

async function updatePreview() {
    if (!selection.left || !selection.right) {
        mashupPreview.style.display = "none";
        mashupPlaceholder.style.display = "block";
        saveMashupBtn.disabled = true;
        return;
    }

    // Construct API URL
    // API Format: https://emojik.vercel.app/s/<e1>_<e2>?size=128
    const url = `https://emojik.vercel.app/s/${selection.left}_${selection.right}?size=128`;

    mashupPreview.style.display = "none";
    mashupPlaceholder.style.display = "block";
    saveMashupBtn.disabled = true;

    // Test load image
    const tempImg = new Image();
    tempImg.onload = () => {
        mashupPreview.src = url;
        mashupPreview.style.display = "block";
        mashupPlaceholder.style.display = "none";
        saveMashupBtn.disabled = false; // Enable save only if valid
    };
    tempImg.onerror = () => {
        // Some combinations don't exist
        setMsg("error", "Diese Kombination ist leider nicht verfügbar.");
    };
    tempImg.src = url;
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

saveMashupBtn?.addEventListener("click", async () => {
    if (!mashupPreview.src) return;

    const token = getToken();
    if (!token) return window.location.replace("/index.html");

    setMsg("ok", "Mashup wird gespeichert...");
    saveMashupBtn.disabled = true;

    try {
        // 1. Fetch the image blob from the external API
        const resp = await fetch(mashupPreview.src);
        if (!resp.ok) throw new Error("Konnte Bild nicht laden.");
        const blob = await resp.blob();

        // 2. Create FormData for your existing backend endpoint
        const fd = new FormData();
        // Backend expects 'avatar' field and checks mime type
        fd.append("avatar", blob, `mashup_${Date.now()}.png`);

        // 3. Upload to your Backend
        const uploadRes = await fetch("/api/auth/avatar", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });

        const data = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) throw new Error(data?.error || "Upload fehlgeschlagen");

        // 4. Update UI
        if (data.user?.avatarUrl) {
            const url = data.user.avatarUrl + `?v=${Date.now()}`;
            currentUser = { ...(currentUser || {}), avatarUrl: url };
            renderAvatar(currentUser);
        }

        setMsg("ok", "Emoji-Avatar erfolgreich gespeichert!");

        // Reset Logic (Optional)
        selection.right = null;
        selection.activeSlot = 2;
        updateKitchenUI();
        updatePreview();

    } catch (err) {
        console.error("MASHUP SAVE ERROR:", err);
        setMsg("error", err.message || "Fehler beim Speichern.");
        saveMashupBtn.disabled = false;
    }
});

initEmojiKitchen();

loadProfile();
