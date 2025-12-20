/**
 * be/usersStore.js
 *
 * Minimaler JSON-"Datastore" für den Prototyp.
 * Statt einer echten DB (Postgres/Mongo) speichern wir Users in einer Datei.
 *
 * Vorteile:
 * - super simpel für FR4/FR5 (Register/Login) und Persistenz über Server-Restart
 * - keine zusätzliche Infrastruktur nötig
 *
 * Nachteile:
 * - keine gleichzeitigen Writes (Race Conditions) -> für Uni-Prototyp ok
 * - nicht skalierbar für Produktion
 *
 * ENV:
 * - USERS_DB_PATH: optionaler Pfad für die User-DB (Tests / andere Umgebungen)
 */

const fs = require("fs/promises");
const path = require("path");

const DB_PATH = process.env.USERS_DB_PATH
    ? process.env.USERS_DB_PATH
    : path.join(__dirname, "..", "db", "users.json");

/**
 * Stellt sicher, dass:
 * - der Ordner existiert
 * - die DB-Datei existiert
 *
 * Wenn nicht vorhanden: wird eine leere Struktur { users: [] } angelegt.
 */
async function ensureDbFile() {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

    try {
        await fs.stat(DB_PATH);
    } catch (err) {
        if (err.code === "ENOENT") {
            await fs.writeFile(DB_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
        } else {
            // keine stillen Fehler, sonst wirkt es wie "random resets"
            throw err;
        }
    }
}

/**
 * Liest die gesamte DB-Datei und liefert ein JS-Objekt:
 * { users: [...] }
 */
async function readDb() {
    await ensureDbFile();
    const raw = await fs.readFile(DB_PATH, "utf8");

    // Wenn JSON mal kaputt wäre, soll es krachen -> einfacher zu debuggen
    return JSON.parse(raw);
}

/**
 * Schreibt die DB atomar:
 * - erst in eine temp Datei schreiben
 * - dann rename() (atomic auf den meisten Filesystemen)
 *
 * Damit vermeiden wir kaputte JSON-Dateien bei Crash während write.
 */
async function writeDb(db) {
    const tmpPath = `${DB_PATH}.tmp`;
    const payload = JSON.stringify(db, null, 2);

    await fs.writeFile(tmpPath, payload, "utf8");
    await fs.rename(tmpPath, DB_PATH);
}

/**
 * Findet User anhand E-Mail (case-insensitive).
 * Gibt User-Objekt oder null zurück.
 */
async function findUserByEmail(email) {
    if (typeof email !== "string" || !email.trim()) return null;

    const db = await readDb();
    const target = email.trim().toLowerCase();

    return db.users.find((u) => String(u.email).toLowerCase() === target) || null;
}

/**
 * Findet User anhand ID.
 * Gibt User-Objekt oder null zurück.
 */
async function findUserById(id) {
    if (typeof id !== "string" || !id.trim()) return null;

    const db = await readDb();
    return db.users.find((u) => u.id === id) || null;
}

/**
 * Fügt einen neuen User in die DB ein.
 * Erwartet ein bereits "fertiges" User-Objekt (id, email, passwordHash,...).
 */
async function createUser(user) {
    const db = await readDb();
    db.users.push(user);
    await writeDb(db);
    return user;
}

module.exports = {
    readDb,
    writeDb,
    findUserByEmail,
    findUserById,
    createUser,
};
