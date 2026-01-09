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
// redis connector
const client = require('./redisClient');
// Keys
const keyRoom = (id) => `room:${id}`;
const keyRoomCode = (code) => `room_code:${code}`;

class RoomManager {

    async createRoom(host, config) {
        const newRoom = new Room(host, config);

        // Serialize
        const roomJson = JSON.stringify(newRoom.toJSON());

        // Save Room Data AND Code Mapping
        // Expire after 24 hours (86400 seconds) to clean up old rooms
        await client.multi()
            .set(keyRoom(newRoom.getRoomId()), roomJson, { EX: 86400 })
            .set(keyRoomCode(newRoom.getRoomCode()), newRoom.getRoomId(), { EX: 86400 })
            .exec();

        return newRoom;
    }

    async joinRoom(user, code, taskName) {
        // 1. Find Room ID by Code
        const roomId = await client.get(keyRoomCode(code));
        if (!roomId) {
            throw new Error("Invalid or expired Room Code");
        }

        // 2. Fetch Room Data
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) {
            throw new Error("Room not found (expired?)");
        }

        // 3. Hydrate Room Object
        const room = Room.fromJSON(JSON.parse(roomDataString));

        // 4. Modify State (Add User)
        room.addParticipant(user, taskName);

        // 5. Save Updated State back to Redis
        // We extend the TTL (Time To Live) since there is activity
        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });

        return room;
    }

    // TIMER (FR9 / FR10)
    async startTimer(roomId, userId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) {
            throw new Error("Room not found");
        }

        const room = Room.fromJSON(JSON.parse(roomDataString));

        room.startTimer(userId);

        await client.set(
            keyRoom(roomId),
            JSON.stringify(room.toJSON()),
            { EX: 86400 }
        );

        return room;
    }

    async stopTimer(roomId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) {
            throw new Error("Room not found");
        }

        const room = Room.fromJSON(JSON.parse(roomDataString));

        const elapsedMs = room.stopTimer();

        await client.set(
            keyRoom(roomId),
            JSON.stringify(room.toJSON()),
            { EX: 86400 }
        );

        return {
            elapsedMs,
            room
        };
    }
    async moveAvatar(roomId, userId, x, y) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null;

        const room = Room.fromJSON(JSON.parse(roomDataString));

        // Update state
        room.updateParticipantPosition(userId, x, y);

        // Save
        await client.set(keyRoom(roomId), JSON.stringify(room.toJSON()), { EX: 86400 });

        return room;
    }
    async removeUser(roomId, userId) {
        const roomDataString = await client.get(keyRoom(roomId));
        if (!roomDataString) return null; // Room doesn't exist/expired

        const room = Room.fromJSON(JSON.parse(roomDataString));

        // Remove the user locally
        room.removeUser(userId);

        // Save updated state to Redis
        await client.set(
            keyRoom(roomId),
            JSON.stringify(room.toJSON()),
            { EX: 86400 }
        );

        return room;
    }
    async kickUser(roomId, requesterId, targetUserId) {
        const roomKey = keyRoom(roomId);
        const roomDataString = await client.get(roomKey);
        if (!roomDataString) throw new Error("Room not found");

        const room = Room.fromJSON(JSON.parse(roomDataString));

        // 1. Security Check: Only Host can kick
        if (room._host.userId !== requesterId) {
            throw new Error("Only the host can kick users");
        }

        // 2. Remove the user
        room.removeUser(targetUserId);

        // 3. Save updated room
        await client.set(roomKey, JSON.stringify(room.toJSON()), { EX: 86400 });

        return room;
    }
}

module.exports = new RoomManager();