/**
 * be/roomRoutes.js
 * API Endpoints for Room operations.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const RoomManager = require('./RoomManager');
const { findUserById } = require('./usersStore');

// Ensure this matches your Auth secret
const JWT_SECRET = process.env.JWT_SECRET || "neveralone-dev-secret"; 

// Middleware to decode Token
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No Authorization header' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid Token' });
    }
};

async function getUserForRoom(userId) {
    const fullUser = await findUserById(userId);
    if (!fullUser) return { userId, username: "Anonymous" };

    return {
        userId: fullUser.id,
        username: fullUser.displayName || fullUser.email,
        avatarUrl: fullUser.avatarUrl // <--- Now we have the avatar!
    };
}
// POST /api/rooms/create
router.post('/create', requireAuth, async (req, res) => {
    try {
        const { task, time, theme, autoStartTimer} = req.body;

        const hostUser = await getUserForRoom(req.user.sub || req.user.id);

        const config = {
            hostTask: task,
            time: parseInt(time),
            theme: theme,
            autoStartTimer: autoStartTimer === true || autoStartTimer === "true"
        };


        const room = await RoomManager.createRoom(hostUser, config);

        res.json({
            success: true,
            ...room.toJSON()
        });
    } catch (e) {
        console.error("Create Room Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/rooms/join
router.post('/join', requireAuth, async (req, res) => {
    try {
        // Frontend sends: { code, task }
        const { code, task } = req.body;

        const user = await getUserForRoom(req.user.sub || req.user.id);

        const room = await RoomManager.joinRoom(user, code, task);
        // Notify all sockets in this room that the data has changed
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());


        res.json({
            success: true,
            ...room.toJSON()
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/rooms/:roomId/timer/start  (FR9)
router.post('/:roomId/timer/start', requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const userId = req.user.sub || req.user.id;

        const room = await RoomManager.startTimer(roomId, userId);
        // --- WEBSOCKET UPDATE ---
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({
            success: true,
            ...room.toJSON()
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// POST /api/rooms/:roomId/timer/stop  (FR10)
router.post('/:roomId/timer/stop', requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;

        const result = await RoomManager.stopTimer(roomId);
        // --- WEBSOCKET UPDATE ---
        req.app.get('io').to(result.room.getRoomId()).emit('room_update', result.room.toJSON());
        res.json({
            success: true,
            elapsedMs: result.elapsedMs,
            room: result.room.toJSON()
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.post('/:roomId/timer/reset', requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await RoomManager.resetTimer(roomId);

        // Notify everyone
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());

        res.json({ success: true, ...room.toJSON() });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// --- NEW: Update Settings (Change Time) ---
router.put('/:roomId/settings', requireAuth, async (req, res) => {
    try {
        const { roomId } = req.params;
        const { duration } = req.body; // e.g. { duration: 50 }

        const room = await RoomManager.updateSettings(roomId, { duration });

        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());

        res.json({ success: true, ...room.toJSON() });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;