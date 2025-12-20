const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const app = require("./_app");
const { backupDb, restoreDb, uniqEmail, apiRegister, apiLogin } = require("./_helpers");

let backup;

beforeEach(async () => { backup = await backupDb(); });
afterEach(async () => { await restoreDb(backup); });

test("FR5: Login klappt nach Registrierung (200 + token)", async () => {
    const email = uniqEmail();

    await apiRegister(app, { email, password: "secret123", displayName: "LoginGuy" });

    const res = await apiLogin(app, { email, password: "secret123" });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(typeof res.body.token, "string");
    assert.equal(res.body.user.email, email.toLowerCase());
});

test("FR5: falsches Passwort -> 401", async () => {
    const email = uniqEmail();

    await apiRegister(app, { email, password: "secret123", displayName: "PwGuy" });

    const res = await apiLogin(app, { email, password: "wrong" });

    assert.equal(res.status, 401);
    assert.equal(res.body.ok, false);
});
