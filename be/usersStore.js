/**
 * be/usersStore.js
 * Redis-based User Persistence
 */
const client = require('./redisClient');

// Helper to format keys
const keyUser = (id) => `user:${id}`;
const keyEmail = (email) => `email:${email.toLowerCase().trim()}`;

/**
 * Find user ID by email, then fetch the user object.
 */
async function findUserByEmail(email) {
    if (!email) return null;

    // 1. Get ID from Email Index
    const id = await client.get(keyEmail(email));
    if (!id) return null;

    // 2. Get User Data
    return findUserById(id);
}

/**
 * Find User by ID directly.
 */
async function findUserById(id) {
    if (!id) return null;

    const data = await client.get(keyUser(id));
    return data ? JSON.parse(data) : null;
}

/**
 * Create a new user.
 * Saves both the user object and the email->id mapping.
 */
async function createUser(user) {
    const { id, email } = user;

    user.points = 0;

    // Default Inventory
    // Everyone owns the default theme and the basic smiley pack
    user.inventory = ['theme_default', 'pack_basic'];

    const userString = JSON.stringify(user);
    await client.multi()
        .set(keyUser(id), userString)
        .set(keyEmail(email), id)
        .exec();

    return user;
}

/**
 * Helper to update specific fields of a user (replaces readDb/writeDb logic).
 */
async function updateUser(id, partialUpdates) {
    const user = await findUserById(id);
    if (!user) throw new Error("User not found");

    const updatedUser = { ...user, ...partialUpdates };

    // Save back to Redis
    await client.set(keyUser(id), JSON.stringify(updatedUser));

    return updatedUser;
}
async function changeUserPoints(id, delta) {
    const user = await findUserById(id);
    if (!user) return null;

    const currentPoints = user.points || 0;
    const newPoints = Math.max(0, currentPoints + delta);
    user.points = newPoints;

    await client.set(keyUser(id), JSON.stringify(user));
    return user;
}

async function addItemToInventory(id, itemId) {
    const user = await findUserById(id);
    if (!user) return null;

    if (!user.inventory) user.inventory = ['theme_default', 'pack_basic'];

    if (!user.inventory.includes(itemId)) {
        user.inventory.push(itemId);
        await client.set(keyUser(id), JSON.stringify(user));
    }
    return user;
}
// readDb/writeDb are removed as they are not efficient for Redis
module.exports = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    changeUserPoints,
    addItemToInventory
};