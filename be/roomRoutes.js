/**
 * be/roomRoutes.js
 * API Endpoints for Room operations.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const RoomManager = require('./RoomManager');

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

// POST /api/rooms/create
router.post('/create', requireAuth, (req, res) => {
    try {
        const { task, time, theme } = req.body;

        const hostUser = {
            userId: req.user.id || req.user.userId || "unknown",
            username: req.user.username || req.user.email || "Anonymous",
            // You can add avatarUrl here if it's in the token
        };

        const config = {
            hostTask: task,         // <--- Map 'task' input to 'hostTask'
            time: parseInt(time),
            theme: theme
        };

        const room = RoomManager.createRoom(hostUser, config);

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
router.post('/join', requireAuth, (req, res) => {
    try {
        // Frontend sends: { code, task }
        const { code, task } = req.body; 
        
        const user = {
            userId: req.user.id || req.user.userId,
            username: req.user.username || req.user.email
        };

        // Pass 'task' to the manager
        const room = RoomManager.joinRoom(user, code, task);

        res.json({
            success: true,
            ...room.toJSON()
        });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;