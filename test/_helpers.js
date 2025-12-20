// test/_helpers.js
const fs = require("node:fs/promises");
const path = require("node:path");
const request = require("supertest");

const DB_PATH = path.join(__dirname, "..", "db", "users.json");

async function safeRead(file) {
    try { return await fs.readFile(file, "utf8"); }
    catch (e) { if (e.code === "ENOENT") return null; throw e; }
}

async function safeWrite(file, content) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, "utf8");
}

async function backupDb() {
    const backup = await safeRead(DB_PATH);
    if (backup === null) {
        await safeWrite(DB_PATH, JSON.stringify({ users: [] }, null, 2));
        return await safeRead(DB_PATH);
    }
    return backup;
}

async function restoreDb(backup) {
    if (backup != null) await safeWrite(DB_PATH, backup);
}

function uniqEmail() {
    return `test-${Date.now()}-${Math.random().toString(16).slice(2)}@mail.com`;
}

// --- API Helper ---
async function apiRegister(app, { email, password, displayName }) {
    return request(app)
        .post("/api/auth/register")
        .send({ email, password, displayName });
}

async function apiLogin(app, { email, password }) {
    return request(app)
        .post("/api/auth/login")
        .send({ email, password });
}

async function makeAuthedUser(app, opts = {}) {
    const email = opts.email || uniqEmail();
    const password = opts.password || "secret123";
    const displayName = opts.displayName || "Tester";

    await apiRegister(app, { email, password, displayName });

    const login = await apiLogin(app, { email, password });
    const token = login.body.token;

    return { email: email.toLowerCase(), password, displayName, token };
}

module.exports = {
    DB_PATH,
    backupDb,
    restoreDb,
    uniqEmail,
    apiRegister,
    apiLogin,
    makeAuthedUser,
};
