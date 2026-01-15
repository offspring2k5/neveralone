/**
 * be/authRoutes.js
 * Auth Routes + Profile & Avatar Handling
 */
const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const usersStore = require("./usersStore");
const { requireAuth } = require("./middleware");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "testpasswort123456";
const https = require('https');

// --- MULTER SETUP (File Uploads) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Save to ../db/user_uploads/avatars
        const uploadDir = path.join(__dirname, "..", "db", "user_uploads", "avatars");
        fs.mkdirSync(uploadDir, { recursive: true }); // Ensure dir exists
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Unique filename: userid-timestamp.ext
        const ext = path.extname(file.originalname) || ".png";
        const filename = `${req.user.id}-${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Only images are allowed"));
    }
});


// --- ROUTES ---

// Register
router.post("/register", async (req, res) => {
    try {
        const { email, password, displayName } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Missing fields" });

        const existing = await usersStore.findUserByEmail(email);

        // Auto-fix corrupt users (missing password)
        if (existing) {
            if (!existing.password) {
                console.log(`Fixing corrupt user: ${email}`);
            } else {
                return res.status(400).json({ error: "Email already taken" });
            }
        }

        const newId = (existing && !existing.password) ? existing.id : require('crypto').randomUUID();

        const newUser = await usersStore.createUser({
            id: newId,
            email,
            password,
            displayName: displayName || email.split('@')[0],
            avatarUrl: null
        });

        res.json({ success: true, userId: newUser.id });
    } catch (e) {
        console.error("Register Error:", e);
        res.status(500).json({ error: "Server error" });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await usersStore.findUserByEmail(email);

        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id, username: user.displayName, email: user.email }, JWT_SECRET, { expiresIn: "24h" });
        res.json({ success: true, token });
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ error: "Server error" });
    }
});

// Me (Get Profile)
router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await usersStore.findUserById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const { password, ...safeUser } = user;
        res.json({ user: safeUser });
    } catch (e) {
        res.status(500).json({ error: "Server error" });
    }
});

// --- NEW: Update Profile (Name) ---
router.patch("/profile", requireAuth, async (req, res) => {
    try {
        const { displayName } = req.body;
        if (!displayName) return res.status(400).json({ error: "Name is required" });

        const updatedUser = await usersStore.updateUser(req.user.id, { displayName });

        const { password, ...safeUser } = updatedUser;
        res.json({ success: true, user: safeUser });
    } catch (e) {
        console.error("Profile Update Error:", e);
        res.status(500).json({ error: "Server error" });
    }
});

// --- NEW: Upload Avatar ---
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        // Construct public URL
        // Server serves /db/user_uploads at /user_uploads
        const avatarUrl = `/user_uploads/avatars/${req.file.filename}`;

        const updatedUser = await usersStore.updateUser(req.user.id, { avatarUrl });

        const { password, ...safeUser } = updatedUser;
        res.json({ success: true, user: safeUser });
    } catch (e) {
        console.error("Avatar Upload Error:", e);
        res.status(500).json({ error: e.message });
    }
});
router.post("/avatar-mashup", requireAuth, async (req, res) => {
    try {
        const { left, right } = req.body;
        if (!left || !right) return res.status(400).json({ error: "Missing emojis" });

        // --- FIX: Dynamic Import for ES Module ---
        // We import the library here because it doesn't support 'require' at the top level
        const emojiMixerModule = await import('emoji-mixer');
        const getEmojiMixUrl = emojiMixerModule.default;

        // Generate URL (detailedErrors=true, oldToNew=true)
        const url = getEmojiMixUrl(left, right, true, true);

        if (!url) {
            return res.status(400).json({ error: "Diese Kombination ist nicht möglich 😔" });
        }

        console.log("--> DEBUG: Generated URL:", url);

        // Download and Save the image from Google
        const filename = `${req.user.id}-${Date.now()}.png`;
        const uploadDir = path.join(__dirname, "..", "db", "user_uploads", "avatars");

        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const filePath = path.join(uploadDir, filename);
        const file = fs.createWriteStream(filePath);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return res.status(400).json({ error: "Google Image Load Failed" });
            }
            response.pipe(file);

            file.on('finish', async () => {
                file.close();
                // Update User
                const avatarUrl = `/user_uploads/avatars/${filename}`;
                const updatedUser = await usersStore.updateUser(req.user.id, { avatarUrl });
                const { password, ...safeUser } = updatedUser;

                res.json({ success: true, user: safeUser });
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => {});
            res.status(500).json({ error: "Download error" });
        });

    } catch (e) {
        console.error("Mashup Error:", e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;