/**
 * be/server.js
 *
 * Express App Entry:
 * - Statische Frontend-Dateien (HTML/CSS/JS) aus /fe/*
 * - API Routes unter /api/*
 * - Uploads (nur user_uploads) öffentlich, NICHT die komplette DB
 */

const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./authRoutes");
const roomRoutes = require('./roomRoutes');
const RoomManager = require('./RoomManager');
const app = express();
const server = http.createServer(app); // Wrap express in HTTP server
const io = new Server(server);
const jwt = require('jsonwebtoken'); // Ensure this is imported
const JWT_SECRET = process.env.JWT_SECRET || "testpasswort123456";
// --- Config ---
const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

// --- Paths ---
const FE_DIR = path.join(__dirname, "..", "fe");
const FE_HTML_DIR = path.join(FE_DIR, "html");
const FE_JS_DIR = path.join(FE_DIR, "js");
const UPLOADS_DIR = path.join(__dirname, "..", "db", "user_uploads");

// --- Middleware ---
app.use(express.json()); // muss vor API-Routen stehen
// --- Share IO with Routes ---
app.set('io', io); // Make 'io' accessible in routes

// --- Socket.io Logic ---
io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);


    socket.on('join_room', ({ roomId, userId }) => {
        socket.join(roomId);


        socket.data.roomId = roomId;
        socket.data.userId = userId;

        console.log(`Socket ${socket.id} (User: ${userId}) joined room ${roomId}`);
    });

    socket.on('send_reaction', ({ roomId, targetUserId, reaction }) => {
        io.to(roomId).emit('reaction_received', { targetUserId, reaction });
    });

    socket.on('move_avatar', async ({ roomId, userId, x, y }) => {
        try {
            const updatedRoom = await RoomManager.moveAvatar(roomId, userId, x, y);
            if (updatedRoom) {
                io.to(roomId).emit('room_update', updatedRoom.toJSON());
            }
        } catch (e) {
            console.error("Move error:", e);
        }
    });


    socket.on('leave_room', async ({ roomId, userId }) => {
        console.log(`User ${userId} leaving room ${roomId}`);
        try {
            const updatedRoom = await RoomManager.removeUser(roomId, userId);
            socket.leave(roomId);

            // Notify remaining users
            if (updatedRoom) {
                io.to(roomId).emit('room_update', updatedRoom.toJSON());
            }
        } catch (e) {
            console.error("Error leaving room:", e);
        }
    });
    socket.on('kick_user', async ({ roomId, targetUserId, token }) => {
        try {
            // 1. Verify who sent the command
            const decoded = jwt.verify(token, JWT_SECRET);
            const requesterId = decoded.sub || decoded.id;

            // 2. Perform Kick
            const updatedRoom = await RoomManager.kickUser(roomId, requesterId, targetUserId);

            // 3. Notify the specific user they were kicked (so they get redirected)
            // We need to find the socket ID of the targetUser?
            // Since we broadcast room updates, the client can check if they are still in the list.
            // But an explicit event is nicer for UI alerts.
            io.to(roomId).emit('kicked_notification', targetUserId);

            // 4. Update everyone else's view
            io.to(roomId).emit('room_update', updatedRoom.toJSON());

        } catch (e) {
            console.error("Kick failed:", e.message);
        }
    });

    socket.on('disconnect', async () => {
        // Retrieve the data we saved during join
        const { roomId, userId } = socket.data;

        if (roomId && userId) {
            console.log(`Socket ${socket.id} disconnected. Removing user ${userId} from room ${roomId}`);
            try {
                const updatedRoom = await RoomManager.removeUser(roomId, userId);
                if (updatedRoom) {
                    io.to(roomId).emit('room_update', updatedRoom.toJSON());
                }
            } catch (e) {
                console.error("Disconnect cleanup error:", e);
            }
        }
    });
    socket.on('create_task', async ({ roomId, userId, text }) => {
        try {
            const updatedRoom = await RoomManager.createTask(roomId, userId, text);
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Create task error", e); }
    });

    socket.on('move_task', async ({ roomId, taskId, x, y }) => {
        try {
            // We broadcast full update for consistency (or you could emit specific 'task_moved' for performance)
            const updatedRoom = await RoomManager.moveTask(roomId, taskId, x, y);
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Move task error", e); }
    });

    socket.on('complete_task', async ({ roomId, taskId }) => {
        try {
            const updatedRoom = await RoomManager.completeTask(roomId, taskId);
            // 1. Tell everyone a task was finished (for sparkle effect)
            io.to(roomId).emit('task_completed_anim', taskId);
            // 2. Update room data (remove task)
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Complete task error", e); }
    });

});
// --- Static Frontend ---
// HTML + CSS: /index.html, /styles.css, /home.html, /user.profile.html
app.use(express.static(FE_HTML_DIR));

// JS Module: /js/api.js, /js/auth.js, ...
app.use("/js", express.static(FE_JS_DIR));

// Optional: Root immer auf index.html (verhindert "Cannot GET /")
app.get("/", (req, res) => {
    res.sendFile(path.join(FE_HTML_DIR, "index.html"));
});

// --- Health ---
app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

// --- API ---
app.use("/api/auth", authRoutes);
app.use('/api/rooms', roomRoutes);

// --- Uploads (öffentlich), aber NICHT /db komplett! ---
app.use("/user_uploads", express.static(UPLOADS_DIR));

// --- Export für Tests ---
module.exports = app;

// --- Start server (nur wenn direkt ausgeführt) ---
if (require.main === module) {
    server.listen(PORT, HOST, () => {
        console.log(`Server running at http://${HOST}:${PORT}/`);
    });
}
