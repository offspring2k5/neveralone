/**
 * be/roomRoutes.js
 * API Endpoints for Room operations.
 */
const express = require('express');
const router = express.Router();
const RoomManager = require('./RoomManager');

// Middleware to get the user from the request (injected by your auth middleware)
const requireAuth = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// POST /api/rooms/create
router.post('/create', requireAuth, (req, res) => {
    try {
        const { task, time, theme } = req.body;

        // Adapt the req.user to match what Room.js expects
        const hostUser = {
            userId: req.user.id || req.user.userId, // adapt to your usersStore structure
            username: req.user.username || req.user.email
        };

        const config = {
            taskName: task,
            time: parseInt(time),
            theme: theme
        };

        const room = RoomManager.createRoom(hostUser, config);

        res.json({
            success: true,
            roomId: room.getRoomId(),
            roomCode: room.getRoomCode(),
            settings: room.getRoomSettings()
        });
    } catch (e) {
        console.error("Create Room Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// POST /api/rooms/join
router.post('/join', requireAuth, (req, res) => {
    try {
        const { code } = req.body;
        
        const user = {
            userId: req.user.id || req.user.userId,
            username: req.user.username || req.user.email
        };

        const room = RoomManager.joinRoom(user, code);

        res.json({
            success: true,
            roomId: room.getRoomId(),
            name: room.getName(),
            settings: room.getRoomSettings() 
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;