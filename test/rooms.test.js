/**
 * test_backend.js
 * Run this in terminal: node test_backend.js
 */
const RoomManager = require('../be/RoomManager');

console.log("--- STARTING BACKEND CHECK ---");

try {
    // 1. Mock a User (normally comes from Auth)
    const hostUser = { userId: "user123", username: "ayden" };

    // 2. Mock Configuration (normally comes from Popup)
    const config = { 
        taskName: "Test Backend Logic", 
        time: 50, 
        theme: "space" 
    };

    console.log("1. Attempting to create room...");
    const room = RoomManager.createRoom(hostUser, config);

    if (room && room.getRoomCode()) {
        console.log("✅ Room Created Success!");
        console.log("   - ID:", room.getRoomId());
        console.log("   - Code:", room.getRoomCode());
        console.log("   - Theme:", room.getRoomSettings().getTheme()); // Check Settings
    } else {
        console.error("❌ Room creation failed (returned null or invalid).");
    }

    // 3. Test Joining
    console.log("\n2. Attempting to join with code: " + room.getRoomCode());
    const guestUser = { userId: "user_999", username: "Guest" };
    const joinedRoom = RoomManager.joinRoom(guestUser, room.getRoomCode());

    if (joinedRoom.getActiveParticipants().length === 2) {
        console.log("✅ Join Success! Participant count is 2.");
    } else {
        console.error("❌ Join failed. Participant count:", joinedRoom.getActiveParticipants().length);
    }

} catch (e) {
    console.error("❌ CRITICAL ERROR:", e.message);
    console.error(e);
}

console.log("--- CHECK COMPLETE ---");