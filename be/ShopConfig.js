/**
 * be/ShopConfig.js
 */
const SHOP_ITEMS = [
    // --- ROOM THEMES ---
    { id: 'theme_cozy',   type: 'theme',  name: '☕ Cozy Fireplace', price: 100 },
    { id: 'theme_forest', type: 'theme',  name: '🌲 Deep Forest',    price: 150 },
    { id: 'theme_space',  type: 'theme',  name: '🚀 Outer Space',    price: 300 },

    // --- EMOJI PACKS ---
    { id: 'pack_animals', type: 'pack',   name: '🐶 Animal Pack',    price: 50 },
    { id: 'pack_fun',     type: 'pack',   name: '🎉 Fun & Objects',  price: 50 },
    { id: 'pack_hearts',  type: 'pack',   name: '❤️ Hearts & Love',  price: 75 }
];

module.exports = SHOP_ITEMS;