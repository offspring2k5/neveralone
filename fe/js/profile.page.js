/**
 * fe/js/profile.page.js
 * Profile & Avatar Editor
 */
import { me, getToken, clearToken } from "./auth.js";
import { patchJson, postJson } from "./api.js";
import { showPrompt, showAlert } from "./ui.js";

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
const cheatTrigger = document.getElementById("cheatTrigger");
// --- EMOJI PACKS ---
const PACKS = {
    'pack_basic': ["😀","😃","😄","😁","😆","😅","😂","🤣","🥲","☺️","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙","😙","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡","💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸","😹","😻","😼","😽","🙀","😿","😾"],
    'pack_animals': ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔"],
    'pack_fun': ["⚽","🏀","🏈","🎨","🧶","🎮","🎲","🎸","🎺","🚀","🛸","⚓","💎","💡","💣","🎈"],
    'pack_hearts': ["❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖"]
};

let currentUser = null;

let selection = {
    left: "😀",
    right: null,
    activeSlot: 1
};

function setMsg(type, text) {
    if(profileMsg) {
        profileMsg.className = `toast ${type}`;
        profileMsg.textContent = text;
        profileMsg.style.display = "block";
    }
}

function formatDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("de-AT");
    } catch {
        return iso;
    }
}

function renderAvatar(u) {
    const initial = (u?.displayName?.[0] || u?.email?.[0] || "?").toUpperCase();

    if(avatarFallback) {
        avatarFallback.textContent = initial;
        avatarFallback.style.display = "block";
    }
    if(avatarImg) avatarImg.style.display = "none";

    if (!u?.avatarUrl) return;

    if(avatarImg) {
        avatarImg.onload = () => {
            avatarImg.style.display = "block";
            if(avatarFallback) avatarFallback.style.display = "none";
        };
        avatarImg.onerror = () => {
            avatarImg.style.display = "none";
            if(avatarFallback) avatarFallback.style.display = "block";
        };
        avatarImg.src = u.avatarUrl;
    }
}

async function loadProfile() {
    const token = getToken(); // 1. Define token properly
    if (!token) {
        window.location.replace("/index.html");
        return;
    }

    // --- FETCH INVENTORY ---
    let availableEmojis = [];
    try {
        const shopRes = await fetch('/api/shop', { headers: { 'Authorization': `Bearer ${token}` }});
        if(shopRes.ok) {
            const shopData = await shopRes.json();
            const inventory = shopData.inventory || [];

            // Always ensure basic pack is present
            if(!inventory.includes('pack_basic')) inventory.push('pack_basic');

            inventory.forEach(itemId => {
                if (PACKS[itemId]) {
                    availableEmojis = availableEmojis.concat(PACKS[itemId]);
                }
            });
        }
    } catch(e) {
        console.error("Shop fetch error", e);
        // Fallback to basic if shop fails
        availableEmojis = PACKS['pack_basic'];
    }

    // Fallback if empty
    if (availableEmojis.length === 0) availableEmojis = PACKS['pack_basic'];

    // Render Grid
    initEmojiKitchen(availableEmojis);

    // --- FETCH USER ---
    try {
        const data = await me();
        const u = data.user || {};
        currentUser = u;

        if(pName) pName.textContent = u.displayName ?? "—";
        if(pEmail) pEmail.textContent = u.email ?? "—";
        if(pCreatedAt) pCreatedAt.textContent = formatDate(u.createdAt);
        if(newName) newName.value = u.displayName ?? "";

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

// 2. Fix function signature to accept the list
function initEmojiKitchen(emojiList = []) {
    if(!emojiGrid) return;

    // 1. Render Grid
    emojiGrid.innerHTML = "";
    emojiList.forEach(emoji => {
        const btn = document.createElement("div");
        btn.className = "emoji-btn";
        btn.textContent = emoji;
        btn.onclick = () => selectEmoji(emoji);
        emojiGrid.appendChild(btn);
    });

    // 2. Slot Click Handlers
    if(slot1) slot1.onclick = () => setActiveSlot(1);
    if(slot2) slot2.onclick = () => setActiveSlot(2);

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
        if (!selection.right) selection.activeSlot = 2;
    } else {
        selection.right = emoji;
    }
    updateKitchenUI();
    updatePreview();
}

function updateKitchenUI() {
    if(!slot1 || !slot2) return;

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
    if(!mashupPreview || !mashupPlaceholder || !saveMashupBtn) return;

    if (!selection.left || !selection.right) {
        mashupPreview.style.display = "none";
        mashupPlaceholder.style.display = "block";
        saveMashupBtn.disabled = true;
        return;
    }

    const url = `https://emojik.vercel.app/s/${selection.left}_${selection.right}?size=128`;

    mashupPreview.style.display = "none";
    mashupPlaceholder.style.display = "block";
    saveMashupBtn.disabled = true;

    const tempImg = new Image();
    tempImg.onload = () => {
        mashupPreview.src = url;
        mashupPreview.style.display = "block";
        mashupPlaceholder.style.display = "none";
        saveMashupBtn.disabled = false;
    };
    tempImg.onerror = () => {
        setMsg("error", "Diese Kombination ist leider nicht verfügbar.");
    };
    tempImg.src = url;
}

// Listeners
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

        if(pName) pName.textContent = newDisplayName;
        if(newName) newName.value = newDisplayName;

        currentUser = { ...(currentUser || {}), displayName: newDisplayName };
        renderAvatar(currentUser);
        setMsg("ok", "Name gespeichert.");
    } catch (err) {
        console.error("PROFILE patch error:", err);
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
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        if (data.user?.avatarUrl) {
            const url = data.user.avatarUrl + `?v=${Date.now()}`;
            currentUser = { ...(currentUser || {}), avatarUrl: url };
            renderAvatar(currentUser);
        }
        avatarFile.value = "";
        setMsg("ok", "Avatar gespeichert.");
    } catch (err) {
        console.error("AVATAR upload error:", err);
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
        const resp = await fetch(mashupPreview.src);
        if (!resp.ok) throw new Error("Konnte Bild nicht laden.");
        const blob = await resp.blob();

        const fd = new FormData();
        fd.append("avatar", blob, `mashup_${Date.now()}.png`);

        const uploadRes = await fetch("/api/auth/avatar", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });

        const data = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok) throw new Error(data?.error || "Upload fehlgeschlagen");

        if (data.user?.avatarUrl) {
            const url = data.user.avatarUrl + `?v=${Date.now()}`;
            currentUser = { ...(currentUser || {}), avatarUrl: url };
            renderAvatar(currentUser);
        }
        setMsg("ok", "Emoji-Avatar erfolgreich gespeichert!");

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

cheatTrigger?.addEventListener("click", async () => {
    const token = getToken();
    if (!token) return;


    const code = await showPrompt("Dev Tools", ""); // No description, empty default
    if (!code) return;


    try {
        const res = await postJson("/api/shop/cheat", { code }, { Authorization: `Bearer ${token}` });


        if (res.success) {
            await showAlert("Success", res.message);

            loadProfile();
        }
    } catch (err) {
        console.error("Cheat error:", err);
        setMsg("error", "Code invalid.");
    }
});

// Start loading
loadProfile();