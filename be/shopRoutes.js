/**
 * be/shopRoutes.js
 */
const express = require('express');
const router = express.Router();
const usersStore = require('./usersStore');
const SHOP_ITEMS = require('./ShopConfig');
const { requireAuth } = require('./middleware');

// Get Shop Items + User Inventory
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await usersStore.findUserById(req.user.id);
        if (!user) return res.status(404).json({ error: "User not found" });

        res.json({
            items: SHOP_ITEMS,
            inventory: user.inventory || [],
            points: user.points || 0
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Buy Item
router.post('/buy', requireAuth, async (req, res) => {
    try {
        const { itemId } = req.body;
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return res.status(404).json({ error: "Item not found" });

        const user = await usersStore.findUserById(req.user.id);
        const currentPoints = user.points || 0;
        const inventory = user.inventory || [];

        if (inventory.includes(itemId)) {
            return res.status(400).json({ error: "You already own this item." });
        }

        if (currentPoints < item.price) {
            return res.status(400).json({ error: "Not enough points." });
        }

        await usersStore.changeUserPoints(user.id, -item.price);
        const updatedUser = await usersStore.addItemToInventory(user.id, itemId);

        res.json({ success: true, points: updatedUser.points, inventory: updatedUser.inventory });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cheat Endpoint
router.post('/cheat', requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: "No code provided" });

        if (code === "rosebud" || code === "kaching") {
            const updatedUser = await usersStore.changeUserPoints(req.user.id, 1000);
            return res.json({ success: true, message: "Cheat activated! +1000 Points", points: updatedUser.points });
        }

        return res.status(400).json({ error: "Invalid code" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;