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

    // Allow client to join a specific room channel
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
    });
    socket.on('send_reaction', ({ roomId, targetUserId, reaction }) => {
        // Broadcast to everyone in the room (including sender)
        io.to(roomId).emit('reaction_received', { targetUserId, reaction });
    });
    socket.on('move_avatar', async ({ roomId, userId, x, y }) => {
        try {
            const updatedRoom = await RoomManager.moveAvatar(roomId, userId, x, y);
            if (updatedRoom) {
                // Broadcast new positions to everyone
                io.to(roomId).emit('room_update', updatedRoom.toJSON());
            }
        } catch (e) {
            console.error("Move error:", e);
        }
    });
    socket.on('disconnect', () => {
        // Handle disconnect if needed
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
