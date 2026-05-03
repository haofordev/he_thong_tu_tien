import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAndGetInfo } from '../src/login.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
    const auth = await loginAndGetInfo(0);
    const { token, config } = auth;
    
    const tables = ['items', 'game_items', 'items_v2'];
    
    for (const table of tables) {
        console.log(`Checking table: ${table}...`);
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, {
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (res.ok) {
            console.log(`[FOUND] Table '${table}' returned data!`);
            const fullRes = await fetch(`${config.SUPABASE_URL}/rest/v1/${table}?select=*`, {
                headers: {
                    'apikey': config.API_KEY,
                    'Authorization': `Bearer ${token}`
                }
            });
            const fullData = await fullRes.json();
            fs.writeFileSync(`items_${table}.json`, JSON.stringify(fullData, null, 2));
            console.log(`Saved ${fullData.length} rows to items_${table}.json`);
            break;
        } else {
            console.log(`Table ${table} failed: ${res.status}`);
        }
    }
}
test();
