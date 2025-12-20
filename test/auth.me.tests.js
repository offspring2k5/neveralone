const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("./_app");
const { backupDb, restoreDb, makeAuthedUser } = require("./_helpers");

let backup;

beforeEach(async () => { backup = await backupDb(); });
afterEach(async () => { await restoreDb(backup); });

test("GET /api/auth/me: ohne Token -> 401", async () => {
    const res = await request(app).get("/api/auth/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
});

test("GET /api/auth/me: mit Token -> Userdaten", async () => {
    const u = await makeAuthedUser(app, { displayName: "MeGuy" });

    const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${u.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.user.email, u.email);
    assert.equal(res.body.user.displayName, "MeGuy");
    assert.equal(typeof res.body.user.createdAt, "string");
});

test("GET /api/auth/me: invalid token -> 401", async () => {
    const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer this.is.not.valid");

    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
});
