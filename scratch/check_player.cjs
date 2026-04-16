
const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN_FILE = path.join(__dirname, '..', 'config', 'token.text');

async function apiRequest(path, method = "GET", data = null, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'tuchangioi.online',
            port: 443,
            path: path,
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${body}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function checkBodyLevel() {
    if (!fs.existsSync(TOKEN_FILE)) return;
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    
    try {
        const [data, gameData] = await Promise.all([
            apiRequest("/api/load", "GET", null, token),
            apiRequest("/api/game-data", "GET", null, token)
        ]);

        const player = data.player;
        console.log("Player bodyStrength:", player.bodyStrength);
        
        // Find if there's any object describing realms
        const likelyRealms = Object.keys(gameData).filter(k => k.toLowerCase().includes('realm'));
        console.log("Keys containing 'realm':", likelyRealms);
        
        likelyRealms.forEach(k => {
            if (Array.isArray(gameData[k])) {
                const r = gameData[k][player.bodyStrength];
                if (r) console.log(`In ${k}[${player.bodyStrength}]: ${r.name}`);
            }
        });

    } catch (e) {
        console.log("Error:", e.message);
    }
}

checkBodyLevel();
