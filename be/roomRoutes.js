/**
 * be/roomRoutes.js
 */
const express = require('express');
const router = express.Router();
const RoomManager = require('./RoomManager');
const { requireAuth } = require('./middleware'); // Fixed Import

// Create Room
router.post('/create', requireAuth, async (req, res) => {
    try {
        const { task, time, theme, autoStartTimer } = req.body;
        const config = {
            roomName: `${req.user.username}'s Room`,
            hostTask: task,
            time: time,
            theme: theme,
            autoStartTimer: autoStartTimer
        };
        const room = await RoomManager.createRoom({ userId: req.user.id, username: req.user.username }, config);
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Join Room
router.post('/join', requireAuth, async (req, res) => {
    try {
        const { code, task } = req.body;
        const room = await RoomManager.joinRoom(
            { userId: req.user.id, username: req.user.username }, code, task
        );
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(404).json({ error: e.message }); }
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

router.put('/:roomId/settings', requireAuth, async (req, res) => {
    try {
        const room = await RoomManager.updateSettings(req.params.roomId, { duration: req.body.duration });
        req.app.get('io').to(room.getRoomId()).emit('room_update', room.toJSON());
        res.json({ success: true, ...room.toJSON() });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;