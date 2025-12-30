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
// This is your Data Adapter. 
// Currently it mocks Redis. Later, you update THIS file to connect to real Redis.
const redis = require('./RedisSimulation'); 

class RoomManager {
    
    createRoom(host, config) {
        // config now expects: { roomName, hostTask, time, theme }
        // create Room instance
        const newRoom = new Room(host, config);

        // persist Room
        redis.saveRoom(newRoom);

        // map share code to Room ID (Redis requirement)
        redis.setKey(newRoom.getRoomCode(), newRoom.getRoomId());

        return newRoom;
    }

    joinRoom(user, code, taskName) {
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

        // add User (prevent duplicates) logic is now inside Room.js
        // We pass the taskName the user typed in the frontend
        room.addParticipant(user, taskName);

        // CRITICAL: Save the updated room state back to Redis
        redis.saveRoom(room); 

        return room;
    }
}

module.exports = new RoomManager();