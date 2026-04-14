import fs from 'fs';

const TOKEN_FILE = './config/token.text';
const BASE_URL = 'https://tuchangioi.online';

async function testGameData() {
    try {
        const res = await fetch(`${BASE_URL}/api/game-data`);
        const data = await res.json();
        console.log("Keys in gameData:", Object.keys(data));
        if (data.CHALLENGE_ZONES) console.log("CHALLENGE_ZONES count:", data.CHALLENGE_ZONES.length);
        if (data.TRIAL_ZONES) console.log("TRIAL_ZONES count:", data.TRIAL_ZONES.length);
        
        // Show one zone sample
        const zones = data.TRIAL_ZONES || data.CHALLENGE_ZONES || [];
        if (zones.length > 0) {
            console.log("Sample Zone:", JSON.stringify(zones[0], null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

testGameData();
