import fs from 'fs';

const TOKEN_FILE = './config/token.text';
const BASE_URL = 'https://tuchangioi.online';

async function checkInventory() {
    if (!fs.existsSync(TOKEN_FILE)) return;
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    
    try {
        const res = await fetch(`${BASE_URL}/api/load`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const player = data.player;
        
        console.log("Inventory length:", player.inventory ? player.inventory.length : 0);
        if (player.inventory && player.inventory.length > 0) {
            console.log("First item in inventory:", JSON.stringify(player.inventory[0], null, 2));
        }
        
        console.log("Equipped items:", player.equipment ? player.equipment.length : 0);
        if (player.equipment && player.equipment.length > 0) {
            console.log("Equipped item example:", JSON.stringify(player.equipment[0], null, 2));
        }

    } catch (e) {
        console.log("Error:", e.message);
    }
}

checkInventory();
