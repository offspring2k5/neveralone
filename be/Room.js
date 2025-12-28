/**
 * be/Room.js
 * Core Entity representing an active Game Session.
 * Purpose:
 * - Holds the state of a single room (UUIDs, Host, Participants, active settings)
 * - Manages its own internal logic (generating codes, adding/removing users)
 * - Acts as the "Blueprint" used by RoomManager to create new instances
 */

const { v4: uuidv4 } = require('uuid');

//HELP shouldnt the be folder not be neccessary bc both are in be? 
const RoomSettings = require('./RoomSettings');
class Room {

    /** according to class diagram
     * @param {Object} _roomId
     * @param {Object} _RoomSettingsId
     * @param {String} _roomCode
     * @param {String} _name
     * @param {User} _host
     * @param {List<User>} _activeParticipants
     * 
     * additional variables
     * actual room settings
     * @param {RoomSettings} _roomSettings
     * theme
     * @param {Object} config
     */

    /** room creation - 
     * assumes as default
     * non private room 
     * 10 max users
     * theme "default"
     * room name "productivity room"
     * hostUser as the only active participant in array list 
    */
    constructor (hostUser, config = {}) {
        this._roomId = uuidv4();
        this._RoomSettingsId = uuidv4();
        this._roomCode = this.generateCode();
        this._name = "productivity room";

        if (typeof hostUser !== 'object') {
            throw new Error("Host must be a user object");
        }
        this._host = hostUser;
        this._activeParticipants = [hostUser];

        const _theme = config.theme || "default";
        
        this._roomSettings = new RoomSettings(false, 10, _theme)

        this._task = {
            title: config.taskName || "to do",
            time: config.time || 30
        };
    }

    // !ToDo: database query
    generateCode() {
        let roomcode = Math.random().toString(36).substring(2,8).toUpperCase();

        return roomcode

    }

    //ToDo: useful broadcast ()
    broadcastStatus() {
        console.log("[status] broadcast")
    }

    removeUser(userId) {
        this._activeParticipants = this._activeParticipants.filter(user => user.userId !== userId)
    }

    //ToDo implementation
    chooseTask(userId, taskId) {
        
    }


    getRoomId() { 
        return this._roomId; 
    }

    getRoomSettingsId() { 
        return this._roomSettingsId; 
    }
    
    getRoomCode() { 
        return this._roomCode; 
    }
    
    getName() { 
        return this._name; 
    }
    
    getHost() { 
        return this._host; 
    }
    
    getRoomSettings() { 
        return this._roomSettings; 
    }
    
    getActiveParticipants() { 
        return this._activeParticipants; 
    }

    //ToDo: user class has toJSON method
    toJSON() {
        return {
            roomId: this._roomId,
            roomSettingsId: this._roomSettingsId,
            roomCode: this._roomCode,
            name: this._name,
            host: this._host,
            settings: this._roomSettings,
            activeParticipants: this._activeParticipants
        };
    }
}
module.exports = Room;