/**
 * be/Room.js
 * Core Entity representing an active Game Session.
 * Purpose:
 * - Holds the state of a single room (UUIDs, Host, Participants, active Settings)
 * - Manages its own internal logic (generating codes, adding/removing users)
 * - Acts as the "Blueprint" used by RoomManager to create new instances
 */

const { randomUUID } = require('crypto');
const RoomSettings = require('./RoomSettings');

class Room {

    /** * @param {User} hostUser - The user object from Auth
     * @param {Object} config - { roomName, hostTask, time, theme }
     */
    constructor (hostUser, config = {}) {
        this._roomId = randomUUID();
        this._roomCode = this.generateCode();
        this._name = config.roomName || "Productivity Session";

        // Host is the first participant
        // We attach their personal task to their user object immediately
        this._host = {
            ...hostUser,
            currentTask: config.hostTask || "Hosting" 
        };
        
        // Initialize participants list with the host
        this._activeParticipants = [this._host];

        // Settings
        const _theme = config.theme || "default";
        this._roomSettings = new RoomSettings(false, 10, _theme);
        
        // Store global timer duration
        this._timerDuration = config.time || 25; 
    }

    generateCode() {
        return Math.random().toString(36).substring(2,8).toUpperCase();
    }
    static fromJSON(data) {
        // 1. Create a dummy instance (inputs don't matter as we overwrite them)
        const room = new Room({ userId: 'temp' }, {});

        // 2. Overwrite properties with saved data
        room._roomId = data.roomId;
        room._roomCode = data.roomCode;
        room._name = data.name;
        room._host = data.host;
        room._activeParticipants = data.activeParticipants || [];
        room._timerDuration = data.timerDuration;

        // 3. Re-hydrate Settings object
        if (data.settings) {
            room._roomSettings = new RoomSettings(
                data.settings.isPrivate,
                data.settings.maxUsers,
                data.settings.theme
            );
        }

        return room;
    }
    /**
     * Adds a new user to the room if they aren't already there.
     * @param {User} user - The user object
     * @param {String} taskName - The task they want to work on
     */
    addParticipant(user, taskName) {
        const exists = this._activeParticipants.find(u => u.userId === user.userId);
        
        if (!exists) {
            const newParticipant = {
                ...user,
                currentTask: taskName || "Working"
            };
            this._activeParticipants.push(newParticipant);
        }
    }

    removeUser(userId) {
        this._activeParticipants = this._activeParticipants.filter(user => user.userId !== userId);
    }

    // Getters
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
            timerDuration: this._timerDuration
        };
    }
}
module.exports = Room;