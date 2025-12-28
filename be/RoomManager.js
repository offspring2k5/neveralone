/**
 * be/RoomManager.js
 * Business Logic Service (Singleton).
 * Purpose:
 * - Centralises the logic for creating, finding, and joining rooms
 * - Acts as the single source of truth for "which rooms exist right now"
 * - Bridges the gap between the API (Routes) and the Data (Redis/Room objects)
 * - Exported as 'new RoomManager()' so the entire app shares one instance
 */
const Room = require('./Room');
const redis = require('./RedisSimulation');

class RoomManager {
    
    createRoom(host, config) {
        // create Room instance
        const newRoom = new Room(host, config);

        // persist Room
        redis.saveRoom(newRoom);

        // map  share code to Room ID (Redis requirement)
        redis.setKey(newRoom.getRoomCode(), newRoom.getRoomId());

        return newRoom;
    }

    joinRoom(user, code) {
        // validate code
        const roomId = redis.getIdByKey(code);
        if (!roomId) {
            throw new Error("Invalid or expired Room Code");
        }

        // retrieve Room
        const room = redis.getRoom(roomId);
        if (!room) {
            throw new Error("Room not found");
        }

        // add User (prevent duplicates)
        const participants = room.getActiveParticipants();
        const alreadyIn = participants.find(u => u.userId === user.userId);
        
        if (!alreadyIn) {
            participants.push(user);
            // In a real DB, you'd save the update here:
            // redis.saveRoom(room); 
        }

        return room;
    }
}

module.exports = new RoomManager();