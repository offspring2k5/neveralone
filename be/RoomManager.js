/**
 * be/RoomManager.js
 */
const Room = require('./Room');
const client = require('./redisClient');
const usersStore = require('./usersStore'); // Needed for point persistence

const keyRoom = (id) => `room:${id}`;
const keyRoomCode = (code) => `room_code:${code}`;

// --- CENTRAL POINT SYSTEM CONFIGURATION ---
const POINTS = {
    TASK_COMPLETE: 10,  // Points for finishing a task
    TIMER_COMPLETE: 50, // Points for staying until timer ends
    EARLY_LEAVE: -20    // Penalty for leaving while timer runs
};

class RoomManager {
    constructor() {
        // We track timer timeouts in memory to trigger events when time is up
        this.timerTimeouts = new Map(); // roomId -> timeoutId
        this.io = null; // Socket.io instance for async broadcasts
    }

    // Call this from server.js to allow async emitting
    setIO(ioInstance) {
        this.io = ioInstance;
    }

    async createRoom(host, config) {
        const newRoom = new Room(host, config);
        const roomJson = JSON.stringify(newRoom.toJSON());

        await client.multi()
            .set(keyRoom(newRoom.getRoomId()), roomJson, { EX: 86400 })
            .set(keyRoomCode(newRoom.getRoomCode()), newRoom.getRoomId(), { EX: 86400 })
            .exec();

        return newRoom;
    }

    async joinRoom(user, code, taskName) {
        const roomId = await client.get(keyRoomCode(code));
        if (!roomId) throw new Error("Invalid or expired Room Code");

        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) throw new Error("Room not found");

        const room = Room.fromJSON(JSON.parse(roomDataString));
        room.addParticipant(user, taskName);

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    // --- UPDATED TIMER LOGIC (Points) ---
    async startTimer(roomId, userId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) throw new Error("Room not found");

        const room = Room.fromJSON(JSON.parse(roomDataString));
        room.startTimer(userId);

        // Calculate remaining time
        const durationMs = room._timerDuration * 60 * 1000;
        const remainingMs = durationMs - room._elapsedTime;

        // Set Timeout to award points when finished
        if (remainingMs > 0) {
            if (this.timerTimeouts.has(roomId)) clearTimeout(this.timerTimeouts.get(roomId));

            const timeoutId = setTimeout(() => this._handleTimerComplete(roomId), remainingMs);
            this.timerTimeouts.set(roomId, timeoutId);
        }

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    // Internal: Triggered when timer naturally finishes
    async _handleTimerComplete(roomId) {
        try {
            const roomDataString = await client.get(keyRoom(roomId));
            if (!roomDataString) return;
            const room = Room.fromJSON(JSON.parse(roomDataString));

            // Stop timer properly
            room.stopTimer();

            // Award Points to all active participants
            const users = room.getActiveParticipants();
            for (const p of users) {
                // 1. Update DB
                await usersStore.changeUserPoints(p.userId, POINTS.TIMER_COMPLETE);
                // 2. Update Room State (Visuals)
                room.updateParticipantScore(p.userId, POINTS.TIMER_COMPLETE);
            }

            // Save
            await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });

            // Notify Frontend
            if (this.io) {
                this.io.to(roomId).emit('room_update', room.toJSON());
                // Optional: Send a toast message
                this.io.to(roomId).emit('toast', { type: 'ok', msg: `Timer finished! +${POINTS.TIMER_COMPLETE} Points!` });
            }

            this.timerTimeouts.delete(roomId);
        } catch (e) {
            console.error("Timer completion error:", e);
        }
    }

    async stopTimer(roomId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) throw new Error("Room not found");
        const room = Room.fromJSON(JSON.parse(roomDataString));

        room.stopTimer();

        // Clear pending point award
        if (this.timerTimeouts.has(roomId)) {
            clearTimeout(this.timerTimeouts.get(roomId));
            this.timerTimeouts.delete(roomId);
        }

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    async resetTimer(roomId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) throw new Error("Room not found");
        const room = Room.fromJSON(JSON.parse(roomDataString));

        room.resetTimer();
        if (this.timerTimeouts.has(roomId)) {
            clearTimeout(this.timerTimeouts.get(roomId));
            this.timerTimeouts.delete(roomId);
        }

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    async updateSettings(roomId, { duration }) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) throw new Error("Room not found");
        const room = Room.fromJSON(JSON.parse(roomDataString));

        if (duration) {
            room.setTimerDuration(duration);
            // Duration change resets timer -> clear timeout
            if (this.timerTimeouts.has(roomId)) {
                clearTimeout(this.timerTimeouts.get(roomId));
                this.timerTimeouts.delete(roomId);
            }
        }

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    async moveAvatar(roomId, userId, x, y) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null;
        const room = Room.fromJSON(JSON.parse(roomDataString));
        room.updateParticipantPosition(userId, x, y);
        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    // --- UPDATED: Penalize Early Leave ---
    async removeUser(roomId, userId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null;

        const room = Room.fromJSON(JSON.parse(roomDataString));

        // CHECK: Is timer running? -> Penalty
        if (room._timerRunning) {
            // Check if user is actually in the room (to avoid double penalty)
            const participant = room.getActiveParticipants().find(u => u.userId === userId);
            if (participant) {
                // Update DB
                await usersStore.changeUserPoints(userId, POINTS.EARLY_LEAVE);
                // No need to update room score since they are leaving
            }
        }

        room.removeUser(userId);

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    async kickUser(roomId, requesterId, targetUserId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) throw new Error("Room not found");
        const room = Room.fromJSON(JSON.parse(roomDataString));

        if (room._host.userId !== requesterId) throw new Error("Only the host can kick users");
        room.removeUser(targetUserId);

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    async createTask(roomId, userId, text) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null;
        const room = Room.fromJSON(JSON.parse(roomDataString));
        room.addTask(userId, text);
        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    async moveTask(roomId, taskId, x, y) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null;
        const room = Room.fromJSON(JSON.parse(roomDataString));
        room.updateTaskPosition(taskId, x, y);
        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }

    // --- UPDATED: Award Points for Task ---
    async completeTask(roomId, taskId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null;

        const room = Room.fromJSON(JSON.parse(roomDataString));

        // completeTask now returns the ownerId
        const ownerId = room.completeTask(taskId);

        if (ownerId) {
            // 1. Update DB
            await usersStore.changeUserPoints(ownerId, POINTS.TASK_COMPLETE);
            // 2. Update Room State (Visuals)
            room.updateParticipantScore(ownerId, POINTS.TASK_COMPLETE);
        }

        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });
        return room;
    }
}

module.exports = new RoomManager();