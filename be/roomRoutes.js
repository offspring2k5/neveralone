/**
 * be/roomRoutes.js
 */
const express = require('express');
const router = express.Router();
const RoomManager = require('./RoomManager');
const usersStore = require('./usersStore');
const { requireAuth } = require('./middleware');

// Create Room
router.post('/create', requireAuth, async (req, res) => {
    try {
        const { task, time, theme, autoStartTimer } = req.body;

        // 1. Fetch full user data
        const fullUser = await usersStore.findUserById(req.user.id);
        if (!fullUser) return res.status(404).json({ error: "User not found" });

        // 2. Prepare Host Object
        const hostUser = {
            userId: fullUser.id,
            // Map 'displayName' (from DB) to 'username' (for Room)
            username: fullUser.displayName,
            avatarUrl: fullUser.avatarUrl,
            points: fullUser.points || 0
        };

        const config = {
            roomName: `${fullUser.displayName}'s Room`,
            hostTask: task,
            time: time,
            theme: theme,
            autoStartTimer: autoStartTimer
        };

        const room = await RoomManager.createRoom(hostUser, config);
        res.json({ success: true, ...room.toJSON() });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Join Room
router.post('/join', requireAuth, async (req, res) => {
    try {
        const { code, task } = req.body;

        // 1. Fetch full user data
        const fullUser = await usersStore.findUserById(req.user.id);
        if (!fullUser) return res.status(404).json({ error: "User not found" });

        // 2. Prepare Participant Object
        const participantUser = {
            userId: fullUser.id,
            // Map 'displayName' (from DB) to 'username' (for Room)
            username: fullUser.displayName,
            avatarUrl: fullUser.avatarUrl,
            points: fullUser.points || 0
        };

        const room = await RoomManager.joinRoom(participantUser, code, task);
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) {
        res.status(404).json({ error: e.message });
    }
});

// Timer Routes
router.post('/:roomId/timer/start', requireAuth, async (req, res) => {
    try {
        const room = await RoomManager.startTimer(req.params.roomId, req.user.id);
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:roomId/timer/stop', requireAuth, async (req, res) => {
    try {
        const room = await RoomManager.stopTimer(req.params.roomId);
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/:roomId/timer/reset', requireAuth, async (req, res) => {
    try {
        const room = await RoomManager.resetTimer(req.params.roomId);
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(400).json({ error: e.message }); }
});
router.post('/:roomId/timer/finish', requireAuth, async (req, res) => {
    try {
        const room = await RoomManager.finishSession(req.params.roomId, req.user.id);
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.put('/:roomId/settings', requireAuth, async (req, res) => {
    try {
        const room = await RoomManager.updateSettings(req.params.roomId, { duration: req.body.duration });
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;