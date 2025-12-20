const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const app = require("./_app");
const { backupDb, restoreDb, uniqEmail, apiRegister } = require("./_helpers");

let backup;

beforeEach(async () => { backup = await backupDb(); });
afterEach(async () => { await restoreDb(backup); });

test("FR4: Registrierung klappt (201)", async () => {
    const email = uniqEmail();

    const res = await apiRegister(app, {
        email,
        password: "secret123",
        displayName: "Tester",
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.user.email, email.toLowerCase());
    assert.equal(res.body.user.displayName, "Tester");
});

test("FR4: Duplicate Email -> 409", async () => {
    const email = uniqEmail();

    await apiRegister(app, { email, password: "secret123", displayName: "A" });
    const res2 = await apiRegister(app, { email, password: "secret123", displayName: "B" });

    assert.equal(res2.status, 409);
    assert.equal(res2.body.ok, false);
});
