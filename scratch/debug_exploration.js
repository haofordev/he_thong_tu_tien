import fs from 'fs';

const TOKEN_FILE = './config/token.text';
const BASE_URL = 'https://tuchangioi.online';

async function checkLoad() {
    if (!fs.existsSync(TOKEN_FILE)) return;
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    
    try {
        const res = await fetch(`${BASE_URL}/api/load`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        console.log("Full load data keys:", Object.keys(data));
        if (data.player) console.log("Player keys:", Object.keys(data.player));
        // Check for common exploration-related keys
        const explorationKeys = Object.keys(data).filter(k => k.toLowerCase().includes('explor') || k.toLowerCase().includes('locat'));
        console.log("Exploration-related keys in data:", explorationKeys);
        explorationKeys.forEach(k => console.log(`${k}:`, data[k]));
        
        // Also check inside player
        const playerExplorationKeys = Object.keys(data.player).filter(k => k.toLowerCase().includes('explor') || k.toLowerCase().includes('locat'));
        console.log("Exploration-related keys in player:", playerExplorationKeys);
        playerExplorationKeys.forEach(k => console.log(`player.${k}:`, data.player[k]));

    } catch (e) {
        console.log("Error:", e.message);
    }
}

checkLoad();
