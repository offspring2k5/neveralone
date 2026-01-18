/**
 * be/ShopConfig.js
 */
const SHOP_ITEMS = [
    // --- ROOM THEMES ---
    { 
        id: 'theme_cozy', 
        type: 'theme', 
        name: '☕ Cozy Fireplace', 
        price: 100,
        // Visuals
        image: 'https://images.unsplash.com/photo-1670996324046-f489f28de4e4?w=1600&fit=crop',
        tint: '#ffaf7b', // Warm Orange
        gradient: 'radial-gradient(circle at 20% 20%, rgba(255, 175, 123, 0.15), transparent 60%), linear-gradient(180deg, #2e1a15 0%, #120705 100%)'
    },
    { 
        id: 'theme_forest', 
        type: 'theme', 
        name: '🌲 Deep Forest', 
        price: 150,
        image: 'https://images.unsplash.com/photo-1701156853677-67182eaa0fa8?w=1600&fit=crop',
        tint: '#84fab0', // Fresh Green
        gradient: 'radial-gradient(circle at 50% 0%, rgba(101, 240, 199, 0.15), transparent 60%), linear-gradient(180deg, #132a13 0%, #061206 100%)'
    },
    { 
        id: 'theme_space', 
        type: 'theme', 
        name: '🚀 Outer Space', 
        price: 300,
        image: 'https://images.unsplash.com/photo-1465101162946-4377e57745c3?w=1600&fit=crop',
        tint: '#d4a7ff', // Neon Purple
        gradient: 'radial-gradient(circle at 80% 20%, rgba(189, 116, 255, 0.2), transparent 50%), linear-gradient(180deg, #1a0b2e 0%, #090312 100%)'
    },
    // New Themes
    { 
        id: 'theme_aquarium', 
        type: 'theme', 
        name: '🏒 Boy Aquarium', 
        price: 600, 
        image: 'https://images.unsplash.com/photo-1586348278474-312d4266bbc3?w=1600&fit=crop',
        tint: '#c71e9f',
        gradient: 'linear-gradient(180deg, #c71e45 0%, #b91ec7 100%)'
    },
    { 
        id: 'theme_cottage', 
        type: 'theme', 
        name: '🏡 The Cottage', 
        price: 1000, 
        image: '/user_uploads/themes/cottage.png',
        tint: '#086326',
        gradient: 'linear-gradient(180deg, #054234 0%, #077322 100%)'
    },
    {
        id: 'theme_cullen',
        type: 'theme',
        name: '🏡 The Villa',
        price: 1400,
        image: '/user_uploads/themes/cullen.jpeg',
        tint: '#ab1302',
        gradient: 'linear-gradient(180deg, #ab1302 0%, #03009e 100%)'
    },

    // --- EMOJI PACKS ---
    { id: 'pack_animals', type: 'pack',   name: '🐶 Animal Pack',    price: 50 },
    { id: 'pack_fun',     type: 'pack',   name: '🎉 Fun & Objects',  price: 50 },
    { id: 'pack_hearts',  type: 'pack',   name: '❤️ Hearts & Love',  price: 75 },
    { id: 'pack_food',    type: 'pack',   name: '🍔 Foodie Pack',    price: 80 },
    { id: 'pack_nature',  type: 'pack',   name: '🌿 Nature Pack',    price: 80 },
    { id: 'pack_travel',  type: 'pack',   name: '✈️ Travel Pack',    price: 100 },
    { id: 'pack_activity',type: 'pack',   name: '⚽ Sports & Play',  price: 90 },
    { id: 'pack_objects', type: 'pack',   name: '🎒 Objects & Tech', price: 70 }

];

module.exports = SHOP_ITEMS;
