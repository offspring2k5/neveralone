/**
 * fe/room.page.js
 */
import { loadHomePage } from './home.page.js';
import { me } from './auth.js';
import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
let countdownInterval = null;
let socket = null;

export async function loadRoomPage(roomData) {
    const app = document.getElementById('app');
    // --- SOCKET SETUP ---
    // Initialize socket if it doesn't exist (window.io comes from the script tag)
    if (!socket) {
        console.log("Initializing Socket via ESM import...");
        socket = io(); // Connects to the same URL as the website (localhost:3000)
    }

    console.log("Socket Status:", socket ? "Active" : "Not Found");
    if (socket) {
        // Tell server we are in this room ID
        socket.emit('join_room', roomData.roomId);

        // Remove previous listener to avoid duplicates
        socket.off('room_update');

        // Listen for updates
        socket.on('room_update', (updatedRoomData) => {
            console.log("Room update received:", updatedRoomData);
            // Re-render the page with new data
            loadRoomPage(updatedRoomData);
        });
    }
    // NEW: Listen for reactions from the server
    if (socket) {
        socket.off('reaction_received');
        socket.on('reaction_received', ({ targetUserId, reaction }) => {
            showReactionOnAvatar(targetUserId, reaction);
        });
    }
    // Timer
    function startCountdown(roomData) {
        if (countdownInterval) clearInterval(countdownInterval);

        const timerEl = document.querySelector('.mini-timer');
        if (!timerEl) return;

        // 1. Calculate Total Time in MS
        const totalDurationMs = (roomData.timerDuration || 25) * 60 * 1000;

        // 2. Get time already passed in previous segments
        const previouslyElapsed = roomData.elapsedTime || 0;

        // Helper function to update the text
        const updateDisplay = (remainingMs) => {
            const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
            const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const sec = String(totalSeconds % 60).padStart(2, '0');
            timerEl.textContent = `${min}:${sec}`;
            return totalSeconds <= 0;
        };

        // Case A: Timer is PAUSED
        if (!roomData.timerRunning) {
            const remaining = totalDurationMs - previouslyElapsed;
            updateDisplay(remaining);
            return;
        }

        // Case B: Timer is RUNNING
        const startTime = new Date(roomData.timerStartedAt).getTime();

        countdownInterval = setInterval(() => {
            const currentSegment = Date.now() - startTime;
            const totalElapsed = previouslyElapsed + currentSegment;
            const remaining = totalDurationMs - totalElapsed;

            const isFinished = updateDisplay(remaining);

            if (isFinished) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                // Optional: Trigger finish alert/sound
                onTimerFinished();
            }
        }, 1000);

        // Run once immediately to avoid 1-second delay
        const currentSegment = Date.now() - startTime;
        updateDisplay(totalDurationMs - (previouslyElapsed + currentSegment));
    }

    function onTimerFinished() {
        alert("Time is up! Session finished.");
        loadHomePage();
    }

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
                <button id="btnStartTimer" class="btn primary">Start Timer</button>
                <button id="btnStopTimer" class="btn secondary">Stop Timer</button>
                <button id="btnLeave" class="btn logout">Exit Room</button>
            </div>
        </div>
    `;
    renderAvatars(participants, roomData.roomId, myUser.id);
    // 5. Render ALL Avatars with THEIR tasks

    document.getElementById('btnStartTimer').disabled = !!roomData.timerRunning;
    document.getElementById('btnStopTimer').disabled = !roomData.timerRunning;

    startCountdown(roomData);

    const token = localStorage.getItem('token');

    document.getElementById('btnStartTimer').onclick = async () => {
        // We do NOT call loadRoomPage here anymore.
        // We wait for the socket 'room_update' event to trigger the re-render.
        await fetch(`/api/rooms/${roomData.roomId}/timer/start`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    };


    document.getElementById('btnStopTimer').onclick = async () => {
        await fetch(`/api/rooms/${roomData.roomId}/timer/stop`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    };



    // Leave Logic...
    document.getElementById('btnLeave').onclick = () => {
        if(socket) socket.emit('leave_room', roomData.roomId); // Optional cleanup
        loadHomePage();
    };
}

function renderAvatars(users, roomId, myUserId) {
    const stage = document.getElementById('avatarStage');
    if(!stage) return;

    stage.innerHTML = users.map(u => {
        // ... (HTML generation remains the same) ...
        const img = u.avatarUrl || 'https://ui-avatars.com/api/?background=random&name=' + (u.username || 'User');
        const task = u.currentTask || "Working";
        return `
            <div class="avatar-char" data-userid="${u.userId}">
                <div class="char-body" style="background-image: url('${img}');"></div>
                <div class="char-name">
                    ${u.username} <br>
                    <span style="font-size:0.7em; opacity:0.8; font-weight:normal;">${task}</span>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.avatar-char').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const targetId = el.getAttribute('data-userid');

            // --- NEW: Prevent Self-Reaction ---
            // If the clicked avatar belongs to me, do nothing.
            if (targetId === myUserId) {
                console.log("Ignored click on own avatar");
                return;
            }

            openReactionMenu(e.clientX, e.clientY, targetId, roomId);
        };
    });
}
function openReactionMenu(x, y, targetUserId, roomId) {
    // Remove existing menu if any
    const existing = document.getElementById('reactionMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'reactionMenu';
    menu.className = 'reaction-menu';
    menu.style.left = x + 'px';
    menu.style.top = (y - 50) + 'px'; // Show slightly above cursor

    const smilies = ['🙂', '☹️', '❤️', '👍', '👎'];

    smilies.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.onclick = () => {
            console.log("Clicked emoji:", emoji); // DEBUG LOG

            if (socket) {
                console.log("Sending reaction via socket...", roomId, targetUserId); // DEBUG LOG
                socket.emit('send_reaction', { roomId, targetUserId, reaction: emoji });
            } else {
                console.error("Socket is NULL! Cannot send reaction."); // ERROR LOG
            }

            menu.remove();
        };
        menu.appendChild(span);
    });

    document.body.appendChild(menu);

    // Close menu if clicking elsewhere
    const closeMenu = () => {
        if (menu.parentNode) menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    // Timeout to prevent immediate closing from the current click event
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function showReactionOnAvatar(userId, emoji) {
    // Find the avatar element
    const avatarEl = document.querySelector(`.avatar-char[data-userid="${userId}"]`);
    if (!avatarEl) return;

    // Create floating element
    const floatEl = document.createElement('div');
    floatEl.textContent = emoji;
    floatEl.className = 'floating-reaction';

    avatarEl.appendChild(floatEl);

    // Remove after animation (1.5s)
    setTimeout(() => {
        floatEl.remove();
    }, 1500);
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