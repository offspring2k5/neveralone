/**
 * be/authRoutes.js
 * Auth API für FR4 (Register) und FR5 (Login) + /me + Profil + Avatar Upload.
 *
 * API:
 * POST   /api/auth/register   -> FR4
 * POST   /api/auth/login      -> FR5 (liefert JWT)
 * GET    /api/auth/me         -> aktueller User (JWT required)
 * PATCH  /api/auth/profile    -> displayName ändern (JWT required) [Richtung FR21]
 * POST   /api/auth/avatar     -> Avatar upload (JWT required)
 */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const {
    findUserByEmail,
    findUserById,
    createUser,   // <--- Added this to exports in usersStore
    updateUser    // <--- Added this to exports in usersStore
} = require("./usersStore");

const router = express.Router();

/** JWT Settings
 * Für euren Prototyp: ENV wenn vorhanden, sonst Fallback.
 * (So bricht es nicht “random”, wenn jemand anders startet.)
 */
const JWT_SECRET = process.env.JWT_SECRET || "neveralone-dev-secret";
const JWT_EXPIRES_IN = "7d";

/** Helpers */
function isValidEmail(email) {
    return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(pw) {
    return typeof pw === "string" && pw.length >= 6;
}

function sanitizeDisplayName(name, email) {
    const n = typeof name === "string" ? name.trim() : "";
    if (n.length >= 2 && n.length <= 30) return n;
    // fallback: part before @
    return String(email).split("@")[0];
}

/** Auth Middleware (JWT required) */
function requireAuth(req, res, next) {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, error: "Kein Token" });

    try {
        req.jwt = jwt.verify(token, JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ ok: false, error: "Token ungültig" });
    }
}

/** --------------------------
 * FR4: Registrierung
 * -------------------------- */
router.post("/register", async (req, res) => {
    try {
        const { email, password, displayName } = req.body ?? {};

        if (!isValidEmail(email)) {
            return res.status(400).json({ ok: false, error: "Ungültige E-Mail-Adresse." });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({ ok: false, error: "Passwort muss mindestens 6 Zeichen haben." });
        }

        const existing = await findUserByEmail(email);
        if (existing) {
            return res.status(409).json({ ok: false, error: "E-Mail ist bereits registriert." });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const safeEmail = email.toLowerCase();
        const safeName = sanitizeDisplayName(displayName, safeEmail);

        const user = {
            id: crypto.randomUUID(),
            email: safeEmail,
            passwordHash,
            createdAt: new Date().toISOString(),
            displayName: safeName,
            points: 0,
            avatarUrl: null,
        };

        /** Persist old
        const db = await readDb();
        db.users.push(user);
        await writeDb(db);
        **/
        await createUser(user);
        return res.status(201).json({
            ok: true,
            user: { id: user.id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        return res.status(500).json({ ok: false, error: "Serverfehler" });
    }
});

/** --------------------------
 * FR5: Login
 * -------------------------- */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body ?? {};

        if (!isValidEmail(email) || typeof password !== "string") {
            return res.status(400).json({ ok: false, error: "Bitte E-Mail und Passwort angeben." });
        }

        const user = await findUserByEmail(email);
        if (!user) return res.status(401).json({ ok: false, error: "Login fehlgeschlagen." });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ ok: false, error: "Login fehlgeschlagen." });

        const token = jwt.sign(
            { sub: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        return res.json({
            ok: true,
            token,
            user: { id: user.id, email: user.email, displayName: user.displayName },
        });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ ok: false, error: "Serverfehler" });
    }
});

/** --------------------------
 * Me: aktueller User (JWT)
 * -------------------------- */
router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await findUserById(req.jwt.sub);
        if (!user) return res.status(401).json({ ok: false, error: "User nicht gefunden" });

        return res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                points: user.points ?? 0,
                createdAt: user.createdAt,
                avatarUrl: user.avatarUrl ?? null,
            },
        });
    } catch (err) {
        console.error("ME ERROR:", err);
        return res.status(500).json({ ok: false, error: "Serverfehler" });
    }
});

/** --------------------------
 * Profil: displayName ändern (JWT)
 * -------------------------- */
router.patch("/profile", requireAuth, async (req, res) => {
    try {
        const displayName = (req.body?.displayName || "").trim();
        if (displayName.length < 2 || displayName.length > 30) {
            return res.status(400).json({ ok: false, error: "Name muss 2–30 Zeichen haben." });
        }

        // Use updateUser (Redis) instead of reading the whole DB
        const user = await updateUser(req.jwt.sub, { displayName });

        res.json({
            ok: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl ?? null
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "Serverfehler" });
    }
});

/** --------------------------
 * Avatar Upload (JWT)
 * Speichert Datei unter: db/user_uploads/avatars/
 * Öffentliche URL (server.js static): /user_uploads/avatars/<file>
 * -------------------------- */
const AVATAR_DIR = path.join(__dirname, "..", "db", "user_uploads", "avatars");
fs.mkdirSync(AVATAR_DIR, { recursive: true });

function extFromMime(mime) {
    if (mime === "image/png") return ".png";
    if (mime === "image/jpeg") return ".jpg";
    if (mime === "image/webp") return ".webp";
    return null;
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, AVATAR_DIR),
        filename: (req, file, cb) => {
            const ext = extFromMime(file.mimetype);
            cb(null, `${req.jwt.sub}-${Date.now()}${ext || ".bin"}`);
        },
    }),
    fileFilter: (req, file, cb) => {
        cb(null, !!extFromMime(file.mimetype));
    },
    limits: { fileSize: 2 * 1024 * 1024 },
});

/**
 * Multer kann Errors werfen (z.B. zu groß). Damit das nicht “still” crasht,
 * wickeln wir upload.single in eine Funktion mit sauberer Antwort.
 */
function uploadAvatar(req, res, next) {
    upload.single("avatar")(req, res, (err) => {
        if (err) {
            // z.B. LIMIT_FILE_SIZE
            return res.status(400).json({ ok: false, error: "Upload fehlgeschlagen (Datei zu groß/ungültig)." });
        }
        if (!req.file) {
            return res.status(400).json({ ok: false, error: "Nur PNG/JPG/WEBP erlaubt." });
        }
        return next();
    });
}

router.post("/avatar", requireAuth, uploadAvatar, async (req, res) => {
    try {
        // Construct public URL
        const avatarUrl = `/user_uploads/avatars/${req.file.filename}`;

        // Save URL to Redis
        const user = await updateUser(req.jwt.sub, { avatarUrl });

        res.json({
            ok: true,
            user: { avatarUrl: user.avatarUrl }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ ok: false, error: "Serverfehler" });
    }
});

module.exports = router;
