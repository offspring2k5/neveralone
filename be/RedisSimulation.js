/**
 * be/RedisMock.js
 * Persistence Layer Adapter (Mock).
 * Purpose:
 * - simulates a Key-Value store (like Redis later)
 * - stores the mapping between "Share Codes" (ABC-123) and "Room IDs" (UUIDs)
 * - holds the active Room objects in memory so they persist between API calls
 * - designed to be easily swapped with a real Redis client in the future
 */
const redisStore = {
    keys: {},   // Maps "SHARE_CODE" -> "roomId"
    rooms: {}   // Maps "roomId" -> Room Object
};

module.exports = {
    // Save the link: Code -> RoomID
    setKey: (code, roomId) => { 
        redisStore.keys[code] = roomId; 
    },

    // Get RoomID by Code
    getIdByKey: (code) => { 
        return redisStore.keys[code]; 
    },

    // Save the actual Room object (Persistence)
    saveRoom: (room) => { 
        redisStore.rooms[room.getRoomId()] = room; 
    },

    // Retrieve Room object
    getRoom: (roomId) => { 
        return redisStore.rooms[roomId]; 
    }
};