/**
 * be/server.js
 */
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./authRoutes");
const roomRoutes = require('./roomRoutes');
const RoomManager = require('./RoomManager');
const shopRoutes = require('./shopRoutes');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || "testpasswort123456";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

const FE_DIR = path.join(__dirname, "..", "fe");
const FE_HTML_DIR = path.join(FE_DIR, "html");
const FE_JS_DIR = path.join(FE_DIR, "js");
const UPLOADS_DIR = path.join(__dirname, "..", "db", "user_uploads");

// --- Middleware ---
app.use(express.json());
app.set('io', io);

// Inject IO into RoomManager
RoomManager.setIO(io);

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
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Move error:", e); }
    });

    socket.on('leave_room', async ({ roomId, userId }) => {
        try {
            const updatedRoom = await RoomManager.removeUser(roomId, userId);
            socket.leave(roomId);
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Error leaving room:", e); }
    });

    socket.on('kick_user', async ({ roomId, targetUserId, token }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const requesterId = decoded.sub || decoded.id;
            const updatedRoom = await RoomManager.kickUser(roomId, requesterId, targetUserId);
            io.to(roomId).emit('kicked_notification', targetUserId);
            io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Kick failed:", e.message); }
    });

    socket.on('disconnect', async () => {
        const { roomId, userId } = socket.data;
        if (roomId && userId) {
            try {
                const updatedRoom = await RoomManager.removeUser(roomId, userId);
                if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
            } catch (e) { console.error("Disconnect cleanup error:", e); }
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
            const updatedRoom = await RoomManager.moveTask(roomId, taskId, x, y);
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Move task error", e); }
    });

    socket.on('complete_task', async ({ roomId, taskId }) => {
        try {
            const updatedRoom = await RoomManager.completeTask(roomId, taskId);
            io.to(roomId).emit('task_completed_anim', taskId);
            if (updatedRoom) io.to(roomId).emit('room_update', updatedRoom.toJSON());
        } catch (e) { console.error("Complete task error", e); }
    });
});

app.use(express.static(FE_HTML_DIR));
app.use("/js", express.static(FE_JS_DIR));
app.get("/", (req, res) => res.sendFile(path.join(FE_HTML_DIR, "index.html")));
app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/shop', shopRoutes);

app.use("/user_uploads", express.static(UPLOADS_DIR));

module.exports = app;

if (require.main === module) {
    server.listen(PORT, HOST, () => {
        console.log(`Server running at http://${HOST}:${PORT}/`);
    });
}