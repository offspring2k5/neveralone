/**
 * fe/js/home.page.js
 * Home Screen + Room Creation/Joining Logic + Rejoin Feature
 */

import { me, getToken, clearToken } from "./auth.js";
import { postJson } from "./api.js";
import { showConfirm, showAlert } from "./ui.js";

export async function loadHomePage() {
    const app = document.getElementById('app');

    // --- 1. REJOIN LOGIC ---
    let rejoinBtnHTML = '';
    const lastRoomString = localStorage.getItem('lastRoom');
    if (lastRoomString) {
        try {
            const lastRoom = JSON.parse(lastRoomString);
            if (Date.now() - lastRoom.timestamp < 24 * 60 * 60 * 1000) {
                rejoinBtnHTML = `
                    <div style="margin-bottom: 20px; text-align: center;">
                        <button id="btnRejoin" class="btn" style="
                            background: rgba(122,167,255,0.15); 
                            border: 1px solid var(--accent); 
                            color: var(--accent);
                            width: 100%;
                            padding: 14px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 10px;
                            cursor: pointer;
                        ">
                            <span>↪️ Rejoin <b>${lastRoom.name}</b></span>
                            <span style="opacity:0.7; font-size:0.9em;">(${lastRoom.roomCode})</span>
                        </button>
                    </div>
                `;
            }
        } catch(e) { console.log("Error parsing last room", e); }
    }

    // --- 2. AUTH CHECK ---
    const token = getToken();
    if (!token) {
        window.location.replace("/index.html");
        return;
    }

    // --- 3. RENDER LAYOUT ---
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
                    <button id="btnShop" class="btn" style="padding:6px 10px; font-size:0.9rem;">🛒 Shop</button>
                    <div class="pill" id="pointPill">⭐ ...</div>
                    
                    <a href="/user.profile.html" class="avatarLink" style="text-decoration: none;">
                        <img id="userAvatarImg" style="display:none">
                        <span id="userAvatarFallback" style="display:none">?</span>
                    </a>

                    <button id="logoutBtn" class="btn logout" style="padding: 8px 12px;">Logout</button>
                </div>
            </div>

            <div id="homeMsg" class="toast" style="display:none; margin-bottom:20px;"></div>

            ${rejoinBtnHTML}

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
                            <img id="bigAvatarImg" style="display:none">
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
                        or Custom minutes:
                        <input type="number" id="confMinutes" min="0" max="180" value="0">
                    </label>
                    <label>
                        <input type="checkbox" id="confAutoStart">
                        Start timer automatically
                    </label>
                    <label>
                        Room Theme
                        <select id="confTheme">
                        </select>
                    </label>
                    <div class="row" style="margin-top:10px; justify-content:flex-end;">
                        <button id="btnCancel" class="btn">Cancel</button>
                        <button id="btnCreateConfirm" class="btn primary">Start Session</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="shopModal" class="modal-overlay">
            <div class="modal-box" style="max-width:600px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h2>Points Shop</h2>
                    <div id="shopPointsDisplay" class="pill">⭐ ...</div>
                </div>
                <p class="muted">Spend points to unlock themes and emojis.</p>
                
                <h3>Room Themes</h3>
                <div id="shopThemes" class="shop-grid">Loading...</div>
                
                <h3 style="margin-top:20px;">Avatar Packs</h3>
                <div id="shopPacks" class="shop-grid">Loading...</div>

                <div class="row" style="margin-top:20px; justify-content:flex-end;">
                    <button id="btnCloseShop" class="btn">Close</button>
                </div>
            </div>
        </div>
    `;

    await bindEventsAndLoadUser();
}

async function bindEventsAndLoadUser() {
    const token = getToken();
    const headers = { 'Authorization': `Bearer ${token}` };

    // --- 1. FETCH SHOP DATA (Needed for Dropdown) ---
    let allShopItems = [];
    try {
        const res = await fetch('/api/shop', { headers });
        if (res.ok) {
            const data = await res.json();
            allShopItems = data.items || [];
        }
    } catch (e) { console.error("Could not load shop items", e); }

    // --- 2. LOAD USER ---
    try {
        const data = await me();
        const u = data.user || {};

        document.getElementById("userNameDisplay").textContent = u.displayName || "User";
        document.getElementById("userEmailDisplay").textContent = u.email || "";
        document.getElementById("pointPill").textContent = `⭐ ${u.points ?? 0}`;

        const inventory = u.inventory || [];
        localStorage.setItem('inventory', JSON.stringify(inventory));

        // PASS BOTH INVENTORY AND SHOP ITEMS
        updateThemeDropdown(inventory, allShopItems);

        // ... rest of user loading (avatars etc) ...
        const initial = (u.displayName?.[0] || u.email?.[0] || "?").toUpperCase();
        // ... (keep existing avatar logic) ...

    } catch (err) {
        // ... (keep existing error handling) ...
    }

    // ... (keep existing button bindings) ...

    // --- UPDATED: Global Shop Logic Updates Dropdown ---
    window.buyItem = async (itemId) => {
        // ... (existing logic) ...
        if (data.success) {
            // ...
            // PASS allShopItems HERE TOO
            updateThemeDropdown(data.inventory, allShopItems);
        }
        // ...
    };

    async function openShop() {
        // ... (existing logic) ...
        // PASS allShopItems HERE TOO (data.items comes from the fresh fetch inside openShop)
        updateThemeDropdown(data.inventory, data.items);
        // ...
    }
}
function updateThemeDropdown(inventory, allShopItems) {
    const select = document.getElementById('confTheme');
    if (!select) return;

    // Clear existing (keep Default)
    select.innerHTML = '<option value="default">Default</option>';

    if (!inventory) inventory = [];

    // Filter only themes from the full shop list
    const themes = allShopItems.filter(i => i.type === 'theme');

    themes.forEach(theme => {
        const opt = document.createElement('option');
        // Use the Shop ID (e.g., 'theme_forest') directly as the value
        opt.value = theme.id; 
        
        if (inventory.includes(theme.id)) {
            opt.textContent = theme.name;
            opt.disabled = false;
        } else {
            opt.textContent = `${theme.name} 🔒`;
            opt.disabled = true;
        }
        select.appendChild(opt);
    });
}

// Global Shop Logic
window.buyItem = async (itemId) => {
    // OLD: if(!confirm("Buy this item?")) return;
    const confirmed = await showConfirm("Confirm Purchase", "Are you sure you want to buy this item?");
    if (!confirmed) return;

    const token = getToken();
    try {
        const res = await fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ itemId })
        });
        const data = await res.json();
        if (data.success) {
            await showAlert("Success", "Purchase successful!"); // OLD: alert()
            openShop();
            document.getElementById('pointPill').textContent = `⭐ ${data.points}`;
            localStorage.setItem('inventory', JSON.stringify(data.inventory));
            updateThemeDropdown(data.inventory);
        } else {
            await showAlert("Error", data.error); // OLD: alert()
        }
    } catch(e) { console.error(e); }
};

async function openShop() {
    const token = getToken();
    try {
        const res = await fetch('/api/shop', { headers: { 'Authorization': `Bearer ${token}` }});
        if(!res.ok) throw new Error("Failed to load shop");
        const data = await res.json();

        document.getElementById('shopModal').classList.add('open');
        renderShop(data.items, data.inventory, data.points);

        localStorage.setItem('inventory', JSON.stringify(data.inventory));
        updateThemeDropdown(data.inventory);
    } catch(e) {
        console.error(e);
        alert("Shop is currently unavailable.");
    }
}

function renderShop(items, inventory, points) {
    const themeContainer = document.getElementById('shopThemes');
    const packContainer = document.getElementById('shopPacks');
    document.getElementById('shopPointsDisplay').textContent = `⭐ ${points}`;

    const createCard = (item) => {
        const isOwned = inventory.includes(item.id);
        const canAfford = points >= item.price;
        let btnHtml = isOwned ? `<button class="shop-btn owned">Owned</button>` :
            canAfford ? `<button class="shop-btn buy" onclick="buyItem('${item.id}')">Buy (${item.price})</button>` :
                `<button class="shop-btn locked">Need ${item.price}</button>`;

        return `
            <div class="shop-item">
                <h4>${item.name}</h4>
                <div class="price">⭐ ${item.price}</div>
                ${btnHtml}
            </div>
        `;
    };

    if(items) {
        themeContainer.innerHTML = items.filter(i => i.type === 'theme').map(createCard).join('');
        packContainer.innerHTML = items.filter(i => i.type === 'pack').map(createCard).join('');
    }
}


loadHomePage();
