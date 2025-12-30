/**
 * fe/home.page.js
 * Home Screen (geschützt).
 * - Lädt Userdaten via /api/auth/me
 * - Zeigt Avatar, DisplayName, Points
 */
/**
 * fe/home.page.js
 * Home Screen + Room Creation/Joining Logic
 */

/**
 * fe/home.page.js
 * Home Screen + Room Creation/Joining Logic
 */

import { me, getToken, clearToken } from "./auth.js";
import { postJson } from "./api.js"; // <--- Added import
import { loadRoomPage } from "./room.page.js";

// We export this function so room.page.js can call it when the user leaves a room
export async function loadHomePage() {
    const app = document.getElementById('app');

    // 1. Auth Check
    const token = getToken();
    if (!token) {
        window.location.replace("/index.html");
        return;
    }

    // 2. Render the HTML Layout
    app.innerHTML = `
        <div class="container">
            <div class="topbar">
                <div class="brand">
                    <div class="logo"></div>
                    <div>
                        <h1>NeverAlone</h1>
                        <p>Focus Together</p>
                    </div>
                </div>
                <div class="row">
                    <div class="pill" id="pointPill">⭐ ...</div>
                    <a href="/user.profile.html" class="avatarLink" style="text-decoration: none;">
                        <img id="userAvatarImg" style="display:none">
                        <span id="userAvatarFallback" style="display:none">?</span>
                    </a>
                    <button id="logoutBtn" class="btn logout" style="padding: 8px 12px;">Logout</button>
                </div>
            </div>

            <div id="homeMsg" class="toast" style="display:none; margin-bottom:20px;"></div>

            <div class="grid">
                
                <div style="display:grid; gap:var(--gap); align-content:start;">
                    
                    <div class="card">
                        <h2>Join a Session</h2>
                        <p class="muted" style="margin-bottom:14px;">Enter a code and your goal.</p>
                        <div class="form">
                            <input type="text" id="joinCodeInput" placeholder="Room Code (e.g. A1B2)">
                            <input type="text" id="joinTaskInput" placeholder="My Task (e.g. Reading)">
                            <button id="btnJoin" class="btn primary">Join Room</button>
                        </div>
                    </div>

                    <div class="card" style="background: linear-gradient(135deg, rgba(122,167,255,.1), rgba(101,240,199,.05)); border-color:var(--accent);">
                        <h2>Start New Session</h2>
                        <p class="muted">Create a custom room and invite others.</p>
                        <button id="btnOpenModal" class="btn primary" style="width:100%; margin-top:10px;">+ Create Room</button>
                    </div>

                </div>

                <div class="card">
                    <div class="profileHeader">
                        <div class="avatarBox">
                            <span id="bigAvatarFallback" class="avatarInitial">?</span>
                        </div>
                        <div class="profileMeta">
                            <div class="nameLine" id="userNameDisplay">Loading...</div>
                            <div class="mailLine" id="userEmailDisplay">...</div>
                        </div>
                    </div>
                    <hr style="border:0; border-top:1px solid var(--border); margin: 15px 0;">
                    <p class="muted" style="font-size:0.9rem;">
                        Ready to focus? Select an option on the left to get started.
                    </p>
                </div>
            </div>
        </div>

        <div id="createModal" class="modal-overlay">
            <div class="modal-box">
                <h2>Configure Room</h2>
                <div class="form">
                    <label>
                        What are you working on?
                        <input type="text" id="confTask" placeholder="e.g. Software Engineering HLD">
                    </label>

                    <label>
                        Duration (Minutes)
                        <select id="confTime">
                            <option value="25">25 Min (Pomodoro)</option>
                            <option value="50">50 Min (Deep Work)</option>
                            <option value="90">90 Min (Marathon)</option>
                        </select>
                    </label>

                    <label>
                        Room Theme
                        <select id="confTheme">
                            <option value="default">Default</option>
                            <option value="cozy">☕ Cozy Fireplace</option>
                            <option value="forest">🌲 Deep Forest</option>
                            <option value="space">🚀 Outer Space</option>
                        </select>
                    </label>

                    <div class="row" style="margin-top:10px; justify-content:flex-end;">
                        <button id="btnCancel" class="btn">Cancel</button>
                        <button id="btnCreateConfirm" class="btn primary">Start Session</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 3. User Data Loading & Event Binding
    await bindEventsAndLoadUser();
}

async function bindEventsAndLoadUser() {
    const pointPill = document.getElementById("pointPill");
    const userAvatarImg = document.getElementById("userAvatarImg");
    const userAvatarFallback = document.getElementById("userAvatarFallback");
    const bigAvatarFallback = document.getElementById("bigAvatarFallback");
    const userNameDisplay = document.getElementById("userNameDisplay");
    const userEmailDisplay = document.getElementById("userEmailDisplay");

    try {
        const data = await me();
        const u = data.user || {};

        // Fill Data
        userNameDisplay.textContent = u.displayName || "User";
        userEmailDisplay.textContent = u.email || "";
        pointPill.textContent = `⭐ ${u.points ?? 0}`;

        // Avatar Logic
        const initial = (u.displayName?.[0] || u.email?.[0] || "?").toUpperCase();
        userAvatarFallback.textContent = initial;
        bigAvatarFallback.textContent = initial;

        if (u.avatarUrl) {
            userAvatarImg.src = u.avatarUrl;
            userAvatarImg.onload = () => {
                userAvatarImg.style.display = "block";
                userAvatarFallback.style.display = "none";
            };
        } else {
            userAvatarFallback.style.display = "block";
        }

    } catch (err) {
        console.error("User load error", err);
        if (err?.status === 401) {
            clearToken();
            window.location.replace("/index.html");
        }
    }

    // --- Event Listeners ---

    // Logout
    document.getElementById("logoutBtn").onclick = () => {
        clearToken();
        window.location.replace("/index.html");
    };

    // Modal Logic
    const modal = document.getElementById('createModal');
    const openBtn = document.getElementById('btnOpenModal');
    const cancelBtn = document.getElementById('btnCancel');

    // Safety check in case elements aren't found
    if(openBtn) openBtn.onclick = () => modal.classList.add('open');
    if(cancelBtn) cancelBtn.onclick = () => modal.classList.remove('open');

    // --- API ACTIONS ---
    const token = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    // 1. CREATE ROOM
    const createBtn = document.getElementById('btnCreateConfirm');
    if(createBtn) {
        createBtn.onclick = async () => {
            const task = document.getElementById('confTask').value || "Working";
            const time = document.getElementById('confTime').value;
            const theme = document.getElementById('confTheme').value;

            try {
                // Using postJson handles JSON stringify and errors
                const data = await postJson('/api/rooms/create', { task, time, theme }, headers);

                if (data.success) {
                    modal.classList.remove('open');
                    loadRoomPage(data); // Switch view
                }
            } catch (e) {
                console.error(e);
                alert(e.message || "Connection Failed");
            }
        };
    }

    // 2. JOIN ROOM
    const joinBtn = document.getElementById('btnJoin');
    if(joinBtn) {
        joinBtn.onclick = async () => {
            const code = document.getElementById('joinCodeInput').value;
            const task = document.getElementById('joinTaskInput').value || "Collaborating";
            if(!code) return alert("Please enter a code");

            try {
                const data = await postJson('/api/rooms/join', { code, task }, headers);

                if (data.success) {
                    loadRoomPage(data); // Switch view
                }
            } catch (e) {
                console.error(e);
                // api.js extracts the error message from the backend response automatically
                alert(e.message || "Room not found or Connection Failed");
            }
        };
    }
}

// Start the page immediately on first load
loadHomePage();

/** 
import { me, getToken, clearToken } from "./auth.js";
import { loadRoomPage } from "./room.page.js";

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
*/