/**
 * be/redisClient.js
 * Central Redis Connection
 */
const { createClient } = require('redis');

// Use environment variable or default to localhost
const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => console.error('Redis Client Error', err));

// Connect immediately (top-level await alternative for CommonJS)
(async () => {
    if (!client.isOpen) {
        await client.connect();
        console.log("✅ Connected to Redis");
    }
})();

module.exports = client;