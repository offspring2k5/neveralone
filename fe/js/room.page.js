/**
 * fe/room.page.js
 */
import { loadHomePage } from './home.page.js';
import { me } from './auth.js'; 

export async function loadRoomPage(roomData) {
    const app = document.getElementById('app');
    
    // 1. Get Me (to identify which avatar is mine)
    let myUser = {};
    try { const d = await me(); myUser = d.user; } catch(e){}

    // 2. Theme Logic... (Same as before)
    document.body.className = ''; 
    if (roomData.settings?.theme) document.body.classList.add(`theme-${roomData.settings.theme}`);

    // 3. Find MY current task from the participant list
    // roomData.activeParticipants comes from the backend now
    const participants = roomData.activeParticipants || [];
    const myParticipantEntry = participants.find(p => p.userId === myUser.id) || {};
    const myTask = myParticipantEntry.currentTask || "Focusing";

    // 4. Render HTML
    app.innerHTML = `
        <div class="room-scene">
            <div class="room-hud">
                <div class="room-info-badge">
                    Code: <strong>${roomData.roomCode}</strong>
                </div>
                
                <div class="hud-timer-box">
                    <div class="mini-timer">${roomData.timerDuration || 25}:00</div>
                    <div class="mini-task">My Goal: ${myTask}</div>
                </div>
            </div>

            <div class="room-floor" id="avatarStage"></div>

            <div class="room-controls">
                <button id="btnLeave" class="btn logout">Exit Room</button>
            </div>
        </div>
    `;

    // 5. Render ALL Avatars with THEIR tasks
    renderAvatars(participants);

    // Leave Logic...
    document.getElementById('btnLeave').onclick = () => { /*...*/ loadHomePage(); };
}

function renderAvatars(users) {
    const stage = document.getElementById('avatarStage');
    if(!stage) return;

    stage.innerHTML = users.map(u => {
        const img = u.avatarUrl || 'https://ui-avatars.com/api/?background=random&name=' + (u.username || 'User');
        // Get the individual task
        const task = u.currentTask || "Working";

        return `
            <div class="avatar-char">
                <div class="char-body" style="background-image: url('${img}');"></div>
                <div class="char-name">
                    ${u.username} <br>
                    <span style="font-size:0.7em; opacity:0.8; font-weight:normal;">${task}</span>
                </div>
            </div>
        `;
    }).join('');
}


/**
 * fe/room.page.js
 * Handles the Active Room View.
 */
/** 
import { loadHomePage } from './home.page.js';

export function loadRoomPage(roomData) {
    const app = document.getElementById('app');
    
    // 1. Apply Theme to Body
    // Reset previous themes first
    document.body.className = ''; 
    if (roomData.settings && roomData.settings.theme) {
        document.body.classList.add(`theme-${roomData.settings.theme}`);
    }

    // 2. Render Room HTML
    app.innerHTML = `
        <div class="container room-container">
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <h2 style="color:var(--muted); text-transform:uppercase; font-size:0.9rem; letter-spacing:1px;">Current Session</h2>
                
                <h1 style="margin: 10px 0;">${roomData.name || "Focus Room"}</h1>
                
                <div style="margin-bottom: 20px;">
                    <span style="color:var(--muted);">Room Code:</span><br>
                    <div class="room-code-badge">${roomData.roomCode || "----"}</div>
                </div>

                <div class="timer-display">
                    ${roomData.task?.time || "25"}:00
                </div>

                <div class="task-focus">
                    <span style="color:var(--muted); font-size:1rem;">Focusing on:</span><br>
                    ${roomData.settings.taskName || "Just Working"}
                </div>

                <div style="margin-top: 30px; display:flex; justify-content:center; gap:10px;">
                     <button class="btn" onclick="alert('Pause not implemented yet')">Pause</button>
                     <button id="btnLeave" class="btn logout">Leave Room</button>
                </div>
            </div>
        </div>
    `;

    // Leave Room
    document.getElementById('btnLeave').onclick = () => {
        if(confirm("Are you sure you want to leave this session?")) {
            // Reset theme
            document.body.className = '';
            // Go back to home
            loadHomePage(); 
        }
    };
}
    */