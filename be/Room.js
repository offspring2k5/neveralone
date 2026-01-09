/**
 * be/Room.js
 */
const { randomUUID } = require('crypto');
const RoomSettings = require('./RoomSettings');

class Room {
    constructor (hostUser, config = {}) {
        this._roomId = randomUUID();
        this._roomCode = this.generateCode();
        this._name = config.roomName || "Productivity Session";

        this._host = {
            ...hostUser,
            currentTask: config.hostTask || "Hosting"
        };

        this._activeParticipants = [this._host];

        const _theme = config.theme || "default";
        const _autoStartTimer = config.autoStartTimer === true || config.autoStartTimer === "true";
        this._roomSettings = new RoomSettings(false, 10, _theme, _autoStartTimer);

        this._timerDuration = config.time || 25;
        this._timerStartedAt = null;
        this._timerRunning = false;
        this._elapsedTime = 0;

        this._tasks = [];

        if (_autoStartTimer && !this._timerRunning) {
            this.startTimer(this._host.userId);
        }
    }

    generateCode() {
        return Math.random().toString(36).substring(2,8).toUpperCase();
    }

    static fromJSON(data) {
        const room = new Room({ userId: 'temp' }, {});
        room._roomId = data.roomId;
        room._roomCode = data.roomCode;
        room._name = data.name;
        room._host = data.host;
        room._activeParticipants = data.activeParticipants || [];
        room._timerDuration = data.timerDuration;
        room._timerStartedAt = data.timerStartedAt || null;
        room._timerRunning = data.timerRunning || false;
        room._elapsedTime = data.elapsedTime || 0;
        if (data.settings) {
            room._roomSettings = new RoomSettings(
                data.settings.isPrivate,
                data.settings.maxUsers,
                data.settings.theme,
                data.settings.autoStartTimer
            );
        }
        room._tasks = data.tasks || [];
        return room;
    }

    addParticipant(user, taskName) {
        const exists = this._activeParticipants.find(u => u.userId === user.userId);
        if (!exists) {
            const newParticipant = {
                ...user,
                currentTask: taskName || "Working",
                x: Math.floor(Math.random() * 70) + 10,
                y: Math.floor(Math.random() * 60) + 20
            };
            this._activeParticipants.push(newParticipant);
        }
    }

    updateParticipantPosition(userId, x, y) {
        const participant = this._activeParticipants.find(u => u.userId === userId);
        if (participant) {
            participant.x = x;
            participant.y = y;
        }
    }

    // --- NEW: Helper to update score in the room list immediately ---
    updateParticipantScore(userId, delta) {
        const participant = this._activeParticipants.find(u => u.userId === userId);
        if (participant) {
            participant.points = (participant.points || 0) + delta;
            // Prevent negative visual score if desired
            if(participant.points < 0) participant.points = 0;
        }
    }

    removeUser(userId) {
        this._activeParticipants = this._activeParticipants.filter(user => user.userId !== userId);
    }

    startTimer(userId) {
        if (this._timerRunning) throw new Error("Timer already running");
        this._timerStartedAt = Date.now();
        this._timerRunning = true;
    }

    stopTimer() {
        if (!this._timerRunning) throw new Error("Timer not running");
        const currentSegment = Date.now() - this._timerStartedAt;
        this._elapsedTime += currentSegment;
        this._timerRunning = false;
        this._timerStartedAt = null;
        return currentSegment;
    }

    resetTimer() {
        this._timerRunning = false;
        this._timerStartedAt = null;
        this._elapsedTime = 0;
    }

    setTimerDuration(minutes) {
        const dura = parseInt(minutes);
        if (!isNaN(dura) && dura > 0) {
            this._timerDuration = dura;
            this.resetTimer();
        }
    }

    addTask(userId, text) {
        const newTask = {
            id: randomUUID(),
            ownerId: userId,
            text: text,
            x: 40 + Math.random() * 20,
            y: 40 + Math.random() * 20,
            completed: false,
            createdAt: Date.now()
        };
        this._tasks.push(newTask);
        return newTask;
    }

    updateTaskPosition(taskId, x, y) {
        const task = this._tasks.find(t => t.id === taskId);
        if (task) {
            task.x = x;
            task.y = y;
        }
    }

    // --- UPDATED: Return owner ID ---
    completeTask(taskId) {
        const task = this._tasks.find(t => t.id === taskId);
        if (!task) return null;

        // Remove task
        this._tasks = this._tasks.filter(t => t.id !== taskId);

        return task.ownerId; // Return owner so Manager can award points
    }

    getRoomId() { return this._roomId; }
    getRoomCode() { return this._roomCode; }
    getName() { return this._name; }
    getHost() { return this._host; }
    getRoomSettings() { return this._roomSettings; }
    getActiveParticipants() { return this._activeParticipants; }

    toJSON() {
        return {
            roomId: this._roomId,
            roomCode: this._roomCode,
            name: this._name,
            host: this._host,
            settings: this._roomSettings,
            activeParticipants: this._activeParticipants,
            timerDuration: this._timerDuration,
            timerStartedAt: this._timerStartedAt,
            timerRunning: this._timerRunning,
            elapsedTime: this._elapsedTime,
            tasks: this._tasks
        };
    }
}
module.exports = Room;