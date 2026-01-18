/**
 * fe/js/room.page.js
 */
import { loadHomePage } from './home.page.js';
import { me } from './auth.js';
import { io } from "https://cdn.socket.io/4.8.1/socket.io.esm.min.js";
import { showConfirm, showPrompt, showAlert } from "./ui.js";

let countdownInterval = null;
let socket = null;

export async function loadRoomPage(roomData) {
    try {
        const lastRoomData = {
            roomId: roomData.roomId,
            roomCode: roomData.roomCode,
            name: roomData.name || "Productivity Room",
            timestamp: Date.now()
        };
        localStorage.setItem('lastRoom', JSON.stringify(lastRoomData));
    } catch (e) {
        console.error("Could not save last room", e);
    }

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
        // Join Room
        socket.emit('join_room', { roomId: roomData.roomId, userId: myUser.id });

        // Room Update Listener
        socket.off('room_update');
        socket.on('room_update', (updatedRoomData) => {
            console.log("Room update received:", updatedRoomData);
            loadRoomPage(updatedRoomData);
        });

        // Reaction Listener
        socket.off('reaction_received');
        socket.on('reaction_received', ({ targetUserId, reaction }) => {
            showReactionOnAvatar(targetUserId, reaction);
        });

        // Kick Listener
        socket.on('kicked_notification', async (kickedId) => {
            if (kickedId === myUser.id) {
                await showAlert("Kicked", "You have been kicked from the room.");
                if(socket) socket.disconnect();
                window.location.href = '/';
            }
        });

        // Sparkle Animation Listener (Task Complete)
        socket.off('task_completed_anim');
        socket.on('task_completed_anim', (taskId) => {
            playSparkle(taskId);
        });
    }

    // --- IDENTIFY HOST ---
    const isHost = (myUser.id === roomData.host.userId);


    // --- TIMER LOGIC ---
    function updateButtonState(isRunning, isFinished) {


        const btnStart = document.getElementById('btnStartTimer');
        const btnStop = document.getElementById('btnStopTimer');
        const btnReset = document.getElementById('btnResetTimer');

        if (isRunning && !isFinished) {
            if(btnStart) btnStart.style.display = 'none';
            if(btnStop) btnStop.style.display = 'inline-block';
            if(btnReset) btnReset.style.display = 'none';
        } else {
            if(btnStart) btnStart.style.display = 'inline-block';
            if(btnStop) btnStop.style.display = 'none';
            if(btnReset) btnReset.style.display = 'inline-block';
        }
    }

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

        // Initial Button State
        const initialRemaining = totalDurationMs - previouslyElapsed;
        updateButtonState(roomData.timerRunning, initialRemaining <= 0);

        if (!roomData.timerRunning) {
            updateDisplay(initialRemaining);
            return;
        }

        const startTime = new Date(roomData.timerStartedAt).getTime();

        countdownInterval = setInterval(() => {
            const currentSegment = Date.now() - startTime;
            const totalElapsed = previouslyElapsed + currentSegment;
            const remaining = totalDurationMs - totalElapsed;

            const isFinished = updateDisplay(remaining);

            if (isFinished) {
                clearInterval(countdownInterval);
                countdownInterval = null;
                onTimerFinished();
            }
        }, 1000);

        updateDisplay(totalDurationMs - (previouslyElapsed + (Date.now() - startTime)));
    }

    function onTimerFinished() {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log("Audio blocked:", e));
        updateButtonState(false, true);
    }

    // --- RENDER HTML ---
    document.body.className = '';
    const themeId = roomData.settings?.theme || 'default';
    applyRoomTheme(themeId);
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
                    <div class="mini-timer" ${isHost ? 'style="cursor:pointer" title="Click to Change Duration"' : ''}>
                        ${roomData.timerDuration || 25}:00
                    </div>
                    <div class="mini-task">My Goal: ${myTask}</div>
                </div>
            </div>

            <div class="user-list-panel">
                <div class="user-list-title">Participants (${participants.length})</div>
                <div id="userListContainer"></div>
            </div>

            <div class="task-list-panel">
                <div class="task-list-title">Tasks</div>
                <div id="taskListContainer"></div>
            </div>

            <div class="room-floor" id="avatarStage">
                <div id="taskLayer"></div> 
            </div>

            <div class="room-controls">
                
                <button id="btnStartTimer" class="btn primary">Start</button>
                <button id="btnStopTimer" class="btn secondary" style="display:none;">Pause</button>
                
                ${isHost ? `
                    <button id="btnResetTimer" class="btn secondary" style="border-color:#ff9f43; color:#ff9f43;">Reset</button>
                ` : ''}
                
                <button id="btnLeave" class="btn logout">Exit</button>
            </div>

            <button class="btn-add-task" id="btnAddTask" title="Add Task">+</button>
        </div>
    `;

    // --- RENDER COMPONENTS ---
    renderAvatars(participants, roomData.roomId, myUser.id);
    renderUserList(participants, roomData.host.userId, myUser.id);
    renderTasks(roomData.tasks || [], participants, roomData.roomId, myUser.id);

    // --- BIND BUTTONS ---
    const token = localStorage.getItem('token');

    // Timer Buttons
    const btnStart = document.getElementById('btnStartTimer');
    const btnStop = document.getElementById('btnStopTimer');

    if(btnStart && btnStop) {
        btnStart.onclick = async () => {
            await fetch(`/api/rooms/${roomData.roomId}/timer/start`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        };
        btnStop.onclick = async () => {
            await fetch(`/api/rooms/${roomData.roomId}/timer/stop`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        };
    }

    // Reset Button
    const btnReset = document.getElementById('btnResetTimer');
    if (btnReset) {
        btnReset.onclick = async () => {
            // OLD: if(!confirm("Reset timer to 00:00?")) return;
            const yes = await showConfirm("Reset Timer", "Reset timer?");
            if(!yes) return;

            await fetch(`/api/rooms/${roomData.roomId}/timer/reset`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        };
    }

    // Edit Timer Duration
    if (isHost) {
        const timerDisplay = document.querySelector('.mini-timer');
        if(timerDisplay) {
            timerDisplay.onclick = async () => {
                // OLD: prompt(...)
                const newTime = await showPrompt("Change Timer", "Set timer duration (minutes):", roomData.timerDuration || 25);

                if (newTime && !isNaN(newTime)) {
                    await fetch(`/api/rooms/${roomData.roomId}/settings`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ duration: newTime })
                    });
                }
            };
        }
    }

    // Add Task Button
    const btnAdd = document.getElementById('btnAddTask');
    if (btnAdd) {
        btnAdd.onclick = async () => {

            const text = await showPrompt("New Task", "What is your task?");
            if (text && text.trim() !== "") {
                socket.emit('create_task', { roomId: roomData.roomId, userId: myUser.id, text: text.trim() });
            }
        };
    }

    // Leave Button
    document.getElementById('btnLeave').onclick = () => {
        if(socket) socket.emit('leave_room', { roomId: roomData.roomId, userId: myUser.id });
        loadHomePage();
    };

    // Start Timer Display
    startCountdown(roomData);

    // Expose Kick Function globally
    window.kickUser = async (targetUserId) => {
        // OLD: if(!confirm("Are you sure you want to remove this user?")) return;
        const yes = await showConfirm("Kick User", "Are you sure you want to remove this user?");
        if(!yes) return;

        if (socket) {
            socket.emit('kick_user', {
                roomId: roomData.roomId,
                targetUserId: targetUserId,
                token: token
            });
        }
    };
}


// --- HELPER FUNCTIONS ---

/** Render Users in Left Panel */
function renderUserList(users, hostId, myId) {
    const container = document.getElementById('userListContainer');
    if (!container) return;

    container.innerHTML = users.map(u => {
        const isMe = u.userId === myId;
        const isTargetHost = u.userId === hostId;
        const img = u.avatarUrl || `https://ui-avatars.com/api/?background=random&name=${u.username}`;


        // Check if I can kick this person (Host only, not myself)
        const canKick = (myId === hostId) && !isMe;

        // Get points (default to 0 if undefined)
        const points = u.points || 0;

        return `
            <div class="user-list-item">
                <div class="ul-avatar" style="background-image: url('${img}')"></div>
                <div class="ul-info">
                    <div class="ul-name">
                        ${u.username} ${isMe ? '(You)' : ''}
                        <span class="points-badge">⭐ ${points}</span>
                    </div>
                    <div class="ul-role">
                        ${isTargetHost ? '👑 Host' : 'Participant'}
                    </div>
                    <div class="ul-role">
                        ${'Status: aktiv'}
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
    }).join('');container.innerHTML = users.map(u => {
        const isMe = u.userId === myId;
        const isTargetHost = u.userId === hostId;
        const img = u.avatarUrl || `https://ui-avatars.com/api/?background=random&name=${u.username}`;

        const canKick = (myId === hostId) && !isMe;
        const points = u.points || 0;

        // Status Logic
        // If 'online' is undefined (old rooms), treat as true
        const isOnline = u.online !== false;
        const statusColor = isOnline ? '#2ecc71' : '#95a5a6'; // Green vs Grey
        const opacity = isOnline ? '1' : '0.5';

        return `
            <div class="user-list-item" style="opacity: ${opacity}">
                <div class="ul-avatar" style="background-image: url('${img}')"></div>
                
                <div class="ul-info">
                    <div class="ul-name-row">
                        <span style="
                            display:inline-block; 
                            width:8px; height:8px; 
                            border-radius:50%; 
                            background-color:${statusColor};
                            margin-right:6px;
                        " title="${isOnline ? 'Online' : 'Offline'}"></span>

                        <span class="ul-name" title="${u.username}">
                            ${u.username} ${isMe ? '(You)' : ''}
                        </span>
                        <span class="points-badge">⭐ ${points}</span>
                    </div>
                    
                    <div class="ul-role">
                        ${isTargetHost ? '👑 Host' : 'Participant'}
                    </div>
                    <div class="ul-role">
                        ${'Status: aktiv'}
                    </div>
                </div>

                ${canKick ? `
                    <div class="btn-kick" onclick="kickUser('${u.userId}')">✕</div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/** Render Tasks (Sticky Notes + Right List) */
function renderTasks(tasks, participants, roomId, myUserId) {
    // 1. Right Side List
    const listContainer = document.getElementById('taskListContainer');
    if (listContainer) {
        if (!tasks || tasks.length === 0) {
            listContainer.innerHTML = '<div style="color:var(--muted); font-size:0.8em; text-align:center;">No active tasks</div>';
        } else {
            listContainer.innerHTML = tasks.map(t => {
                const owner = participants.find(p => p.userId === t.ownerId);
                const ownerName = owner ? owner.username : 'Unknown';
                return `
                    <div class="task-list-item">
                        <div style="flex:1;">
                            <div style="font-weight:bold;">${t.text}</div>
                            <div style="font-size:0.7em; color:var(--muted);">${ownerName}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 2. Floating Room Tasks
    const taskLayer = document.getElementById('taskLayer');
    if (!taskLayer) return;

    taskLayer.innerHTML = ''; // Clear current

    if(tasks) {
        tasks.forEach(t => {
            const isMine = t.ownerId === myUserId;

            const el = document.createElement('div');
            el.className = `room-task ${isMine ? 'draggable' : ''}`;
            el.id = `task-${t.id}`;
            el.style.left = t.x + '%';
            el.style.top = t.y + '%';

            el.innerHTML = `
                ${isMine ? `<div class="task-checkbox" title="Complete Task"></div>` : ''}
                <div>${t.text}</div>
            `;

            if (isMine) {
                // Checkbox Click
                const cb = el.querySelector('.task-checkbox');
                if(cb) {
                    cb.onclick = (e) => {
                        e.stopPropagation();
                        socket.emit('complete_task', { roomId, taskId: t.id });
                    };
                }
                // Drag Logic
                makeTaskDraggable(el, roomId, t.id);
            }

            taskLayer.appendChild(el);
        });
    }
}

/** Sparkle Animation */
function playSparkle(taskId) {
    const el = document.getElementById(`task-${taskId}`);
    if (el) {
        const rect = el.getBoundingClientRect();
        for(let i=0; i<8; i++) {
            const s = document.createElement('div');
            s.textContent = '✨';
            s.className = 'sparkle';
            // Random position around the task
            s.style.left = (rect.left + Math.random() * rect.width) + 'px';
            s.style.top = (rect.top + Math.random() * rect.height) + 'px';
            document.body.appendChild(s);
            setTimeout(() => s.remove(), 800);
        }
    }
}

/** Render Avatars on Floor */
function renderAvatars(users, roomId, myUserId) {
    const stage = document.getElementById('avatarStage');
    if(!stage) return;
    // We only want to clear avatars, NOT the task layer.
    // But since renderAvatars usually runs alongside renderTasks,
    // we can clear safely IF we re-append taskLayer or structure differently.
    // BETTER: Only remove .avatar-char elements to avoid killing the task layer
    stage.querySelectorAll('.avatar-char').forEach(e => e.remove());

    users.forEach(u => {
        const img = u.avatarUrl || 'https://ui-avatars.com/api/?background=random&name=' + (u.username || 'User');
        const task = u.currentTask || "Working";
        const posX = u.x !== undefined ? u.x : 50;
        const posY = u.y !== undefined ? u.y : 50;

        const el = document.createElement('div');
        el.className = 'avatar-char';
        el.setAttribute('data-userid', u.userId);
        el.style.left = posX + '%';
        el.style.top = posY + '%';
        el.innerHTML = `
            <div class="char-body" style="background-image: url('${img}');"></div>
            <div class="char-name">
                ${u.username} <br>
                <span style="font-size:0.7em; opacity:0.8; font-weight:normal;">${task}</span>
            </div>
        `;

        const isMe = (u.userId === myUserId);
        el.onclick = (e) => {
            if (isDragOccurred) return;
            if (isMe) return;
            e.stopPropagation();
            openReactionMenu(e.clientX, e.clientY, u.userId, roomId);
        };

        if (isMe) makeDraggable(el, roomId, myUserId);
        stage.appendChild(el);
    });
}

/** Avatar Drag Logic */
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

/** Task Drag Logic */
function makeTaskDraggable(el, roomId, taskId) {
    let startX, startY, initialLeft, initialTop;
    const stage = document.getElementById('avatarStage');
    let isDrag = false;

    el.onmousedown = (e) => {
        e.preventDefault();
        isDrag = false;
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
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDrag = true;

        const stageRect = stage.getBoundingClientRect();
        const percentX = (dx / stageRect.width) * 100;
        const percentY = (dy / stageRect.height) * 100;

        let newLeft = Math.max(0, Math.min(95, initialLeft + percentX));
        let newTop = Math.max(0, Math.min(95, initialTop + percentY));

        el.style.left = newLeft + '%';
        el.style.top = newTop + '%';
    }

    function onMouseUp(e) {
        document.onmousemove = null;
        document.onmouseup = null;

        if (isDrag && socket) {
            const finalLeft = parseFloat(el.style.left);
            const finalTop = parseFloat(el.style.top);
            socket.emit('move_task', { roomId, taskId, x: finalLeft, y: finalTop });
        }
    }
}

/** Reaction Menu (Smart Position) */
function openReactionMenu(x, y, targetUserId, roomId) {
    const existing = document.getElementById('reactionMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'reactionMenu';
    menu.className = 'reaction-menu';

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

    const rect = menu.getBoundingClientRect();
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const margin = 20;

    let finalX = x;
    let finalY = y - 50;

    if (finalX + rect.width > screenW - margin) finalX = screenW - rect.width - margin;
    if (finalX < margin) finalX = margin;

    if (finalY < margin) finalY = y + 20;
    if (finalY + rect.height > screenH - margin) finalY = screenH - rect.height - margin;

    menu.style.left = finalX + 'px';
    menu.style.top = finalY + 'px';

    void menu.offsetWidth;
    menu.style.animation = '';
    menu.style.visibility = '';

    const closeMenu = () => {
        if (menu.parentNode) menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

/** Show Reaction Bubble */
function showReactionOnAvatar(userId, emoji) {
    const avatarEl = document.querySelector(`.avatar-char[data-userid="${userId}"]`);
    if (!avatarEl) return;
    const floatEl = document.createElement('div');
    floatEl.textContent = emoji;
    floatEl.className = 'floating-reaction';
    avatarEl.appendChild(floatEl);
    setTimeout(() => floatEl.remove(), 1500);
}
async function applyRoomTheme(themeId) {
    const token = localStorage.getItem('token');
    let items = [];
    try {
        const res = await fetch('/api/shop', { headers: { 'Authorization': `Bearer ${token}` }});
        const data = await res.json();
        items = data.items || [];
    } catch(e) { console.error("Could not load theme details", e); }

    const theme = items.find(i => i.id === themeId);
    
    // Default Fallbacks
    const bgImage = theme?.image || "https://plus.unsplash.com/premium_photo-1661875977781-adbb21036841?w=1600&fit=crop";
    const bgGradient = theme?.gradient || "linear-gradient(160deg, #0b1020, #0f1b3d)";
    const timerColor = theme?.tint || "#65f0c7";

    // Apply Styles
    const roomScene = document.querySelector('.room-scene');
    const timerEl = document.querySelector('.mini-timer');

    // Set Background Image
    if(roomScene) roomScene.style.backgroundImage = `url('${bgImage}')`;
    
    // Set Body Gradient (The atmosphere behind the image)
    document.body.style.background = bgGradient;

    // Set Timer Color
    if(timerEl) timerEl.style.color = timerColor;
}
