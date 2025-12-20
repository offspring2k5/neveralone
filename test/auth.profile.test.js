const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("./_app");
const { backupDb, restoreDb, makeAuthedUser } = require("./_helpers");

let backup;

beforeEach(async () => { backup = await backupDb(); });
afterEach(async () => { await restoreDb(backup); });

test("PATCH /api/auth/profile: Name ändern -> /me zeigt neuen Namen", async () => {
    const u = await makeAuthedUser(app, { displayName: "OldName" });

    const patch = await request(app)
        .patch("/api/auth/profile")
        .set("Authorization", `Bearer ${u.token}`)
        .send({ displayName: "NewName" });

    assert.equal(patch.status, 200);
    assert.equal(patch.body.ok, true);
    assert.equal(patch.body.user.displayName, "NewName");

    const meRes = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${u.token}`);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.user.displayName, "NewName");
});

test("PATCH /api/auth/profile: ohne Token -> 401", async () => {
    const res = await request(app)
        .patch("/api/auth/profile")
        .send({ displayName: "Nope" });

    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
});

test("PATCH /api/auth/profile: Name zu kurz -> 400", async () => {
    const u = await makeAuthedUser(app, { displayName: "OkName" });

    const res = await request(app)
        .patch("/api/auth/profile")
        .set("Authorization", `Bearer ${u.token}`)
        .send({ displayName: "A" });

    assert.equal(res.status, 400);
    assert.equal(res.body.ok, false);
});
