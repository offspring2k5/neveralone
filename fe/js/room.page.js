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
    let myUser = {};
    try {
        const d = await me();
        myUser = d.user;
    } catch(e) {
        console.error("Failed to load user:", e);
    }

    // --- SOCKET SETUP ---
    if (!socket) {
        console.log("Initializing Socket via ESM import...");
        socket = io();
    }

    if (socket) {
        socket.emit('join_room', { roomId: roomData.roomId, userId: myUser.id });

        socket.off('room_update');
        socket.on('room_update', (updatedRoomData) => {
            console.log("Room update received:", updatedRoomData);
            loadRoomPage(updatedRoomData);
        });

        // Listen for reactions
        socket.off('reaction_received');
        socket.on('reaction_received', ({ targetUserId, reaction }) => {
            showReactionOnAvatar(targetUserId, reaction);
        });

        // NEW: Listen for Kicked Notification
        socket.off('kicked_notification');
        socket.on('kicked_notification', (kickedId) => {
            if (kickedId === myUser.id) {
                alert("You have been kicked from the room.");
                if(socket) socket.disconnect(); // Clean disconnect
                // Reload page to reset state/socket fully or just load home
                window.location.href = '/';
            }
        });
    }

    // --- TIMER LOGIC ---
    function startCountdown(roomData) {
        if (countdownInterval) clearInterval(countdownInterval);

        const timerEl = document.querySelector('.mini-timer');
        if (!timerEl) return;

        const totalDurationMs = (roomData.timerDuration || 25) * 60 * 1000;
        const previouslyElapsed = roomData.elapsedTime || 0;

        const updateDisplay = (remainingMs) => {
            const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
            const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const sec = String(totalSeconds % 60).padStart(2, '0');
            timerEl.textContent = `${min}:${sec}`;
            return totalSeconds <= 0;
        };

        if (!roomData.timerRunning) {
            updateDisplay(totalDurationMs - previouslyElapsed);
            return;
        }

        const startTime = new Date(roomData.timerStartedAt).getTime();

        countdownInterval = setInterval(() => {
            const currentSegment = Date.now() - startTime;
            const totalElapsed = previouslyElapsed + currentSegment;
            const remaining = totalDurationMs - totalElapsed;

            if (updateDisplay(remaining)) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                onTimerFinished();
            }
        }, 1000);

        // Initial update
        updateDisplay(totalDurationMs - (previouslyElapsed + (Date.now() - startTime)));
    }

    function onTimerFinished() {
        // alert("Time is up!");
    }

    // --- RENDER ROOM ---
    document.body.className = '';
    if (roomData.settings?.theme) document.body.classList.add(`theme-${roomData.settings.theme}`);

    const participants = roomData.activeParticipants || [];
    const myParticipantEntry = participants.find(p => p.userId === myUser.id) || {};
    const myTask = myParticipantEntry.currentTask || "Focusing";

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

            <div class="user-list-panel">
                <div class="user-list-title">Participants (${participants.length})</div>
                <div id="userListContainer"></div>
            </div>

            <div class="room-floor" id="avatarStage"></div>

            <div class="room-controls">
                <button id="btnStartTimer" class="btn primary">Start Timer</button>
                <button id="btnStopTimer" class="btn secondary">Stop Timer</button>
                <button id="btnLeave" class="btn logout">Exit Room</button>
            </div>
        </div>
    `;

    // Render Components
    renderAvatars(participants, roomData.roomId, myUser.id);
    renderUserList(participants, roomData.host.userId, myUser.id);

    // Bind Buttons
    const btnStart = document.getElementById('btnStartTimer');
    const btnStop = document.getElementById('btnStopTimer');
    const token = localStorage.getItem('token');

    if(btnStart) {
        btnStart.disabled = !!roomData.timerRunning;
        btnStart.onclick = async () => {
            await fetch(`/api/rooms/${roomData.roomId}/timer/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        };
    }

    if(btnStop) {
        btnStop.disabled = !roomData.timerRunning;
        btnStop.onclick = async () => {
            await fetch(`/api/rooms/${roomData.roomId}/timer/stop`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        };
    }

    document.getElementById('btnLeave').onclick = () => {
        if(socket) socket.emit('leave_room', { roomId: roomData.roomId, userId: myUser.id });
        loadHomePage();
    };

    // Start Timer Display
    startCountdown(roomData);

    // --- DEFINE KICK FUNCTION (Inside scope to access roomData) ---
    window.kickUser = (targetUserId) => {
        if(!confirm("Are you sure you want to remove this user?")) return;

        if (socket) {
            socket.emit('kick_user', {
                roomId: roomData.roomId,
                targetUserId: targetUserId,
                token: token // Send token for verification
            });
        }
    };
}

// --- HELPER FUNCTIONS ---

// NEW: Render User List with Kick Buttons
function renderUserList(users, hostId, myId) {
    const container = document.getElementById('userListContainer');
    if (!container) return;

    container.innerHTML = users.map(u => {
        const isMe = u.userId === myId;
        const isTargetHost = u.userId === hostId;
        const img = u.avatarUrl || `https://ui-avatars.com/api/?background=random&name=${u.username}`;

        // Show kick button IF: I am the host AND target is not me
        const iAmHost = (myId === hostId);
        const canKick = iAmHost && !isMe;

        return `
            <div class="user-list-item">
                <div class="ul-avatar" style="background-image: url('${img}')"></div>
                <div class="ul-info">
                    <div class="ul-name">
                        ${u.username} ${isMe ? '(You)' : ''}
                    </div>
                    <div class="ul-role">
                        ${isTargetHost ? '👑 Host' : 'Participant'}
                    </div>
                </div>
                ${canKick ? `
                    <div class="btn-kick" 
                         title="Remove User" 
                         onclick="kickUser('${u.userId}')">
                         ✕
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderAvatars(users, roomId, myUserId) {
    const stage = document.getElementById('avatarStage');
    if(!stage) return;

    stage.innerHTML = users.map(u => {
        const img = u.avatarUrl || 'https://ui-avatars.com/api/?background=random&name=' + (u.username || 'User');
        const task = u.currentTask || "Working";
        const posX = u.x !== undefined ? u.x : 50;
        const posY = u.y !== undefined ? u.y : 50;

        return `
            <div class="avatar-char" 
                 data-userid="${u.userId}"
                 style="left: ${posX}%; top: ${posY}%;">
                <div class="char-body" style="background-image: url('${img}');"></div>
                <div class="char-name">
                    ${u.username} <br>
                    <span style="font-size:0.7em; opacity:0.8; font-weight:normal;">${task}</span>
                </div>
            </div>
        `;
    }).join('');

    document.querySelectorAll('.avatar-char').forEach(el => {
        const targetUserId = el.getAttribute('data-userid');
        const isMe = (targetUserId === myUserId);

        el.onclick = (e) => {
            if (isDragOccurred) return;
            if (isMe) return; // No self-reactions
            e.stopPropagation();
            openReactionMenu(e.clientX, e.clientY, targetUserId, roomId);
        };

        if (isMe) makeDraggable(el, roomId, myUserId);
    });
}

let isDragOccurred = false;

function makeDraggable(el, roomId, userId) {
    let startX, startY, initialLeft, initialTop;
    const stage = document.getElementById('avatarStage');

    el.onmousedown = (e) => {
        e.preventDefault();
        isDragOccurred = false;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseFloat(el.style.left);
        initialTop = parseFloat(el.style.top);
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
    };

    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragOccurred = true;

        const stageRect = stage.getBoundingClientRect();
        const percentX = (dx / stageRect.width) * 100;
        const percentY = (dy / stageRect.height) * 100;

        // Clamp to screen (5% to 95%)
        let newLeft = Math.max(5, Math.min(95, initialLeft + percentX));
        let newTop = Math.max(5, Math.min(95, initialTop + percentY));

        el.style.left = newLeft + '%';
        el.style.top = newTop + '%';
    }

    function onMouseUp(e) {
        document.onmousemove = null;
        document.onmouseup = null;

        if (isDragOccurred && socket) {
            const finalLeft = parseFloat(el.style.left);
            const finalTop = parseFloat(el.style.top);
            socket.emit('move_avatar', { roomId, userId, x: finalLeft, y: finalTop });
        }
    }
}

function openReactionMenu(x, y, targetUserId, roomId) {
    const existing = document.getElementById('reactionMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'reactionMenu';
    menu.className = 'reaction-menu';

    // --- KEY FIX: Hide & Disable Animation for Measuring ---
    // We must measure the menu at FULL size (scale 1) to know if it fits.
    menu.style.visibility = 'hidden';
    menu.style.animation = 'none';

    const smilies = ['🙂', '☹️', '❤️', '👍', '👎','🤣','💀','✨','🙀','😭','🦄','🦐'];

    smilies.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.onclick = () => {
            if (socket) socket.emit('send_reaction', { roomId, targetUserId, reaction: emoji });
            menu.remove();
        };
        menu.appendChild(span);
    });

    document.body.appendChild(menu);

    // 1. Measure the Menu (Now it is full size)
    const rect = menu.getBoundingClientRect();
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const margin = 20;

    let finalX = x;
    let finalY = y - 50; // Default: above cursor

    // 2. Adjust Horizontal Position
    // If it goes off the RIGHT edge:
    if (finalX + rect.width > screenW - margin) {
        finalX = screenW - rect.width - margin;
    }
    // If it goes off the LEFT edge (e.g. on mobile):
    if (finalX < margin) {
        finalX = margin;
    }

    // 3. Adjust Vertical Position
    // If it goes off the TOP edge:
    if (finalY < margin) {
        finalY = y + 20; // Flip to below the cursor
    }
    // If it goes off the BOTTOM edge:
    if (finalY + rect.height > screenH - margin) {
        finalY = screenH - rect.height - margin;
    }

    // 4. Apply Calculated Position
    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';

    // --- RESTORE ANIMATION ---
    // Force a browser reflow (read a property) so the 'none' animation applies immediately
    void menu.offsetWidth;

    // Now re-enable the CSS animation and show the menu
    menu.style.animation = '';
    menu.style.visibility = '';

    // 5. Cleanup Listener
    const closeMenu = () => {
        if (menu.parentNode) menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

function showReactionOnAvatar(userId, emoji) {
    const avatarEl = document.querySelector(`.avatar-char[data-userid="${userId}"]`);
    if (!avatarEl) return;
    const floatEl = document.createElement('div');
    floatEl.textContent = emoji;
    floatEl.className = 'floating-reaction';
    avatarEl.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1500);
}