import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAndGetInfo } from '../src/login.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test() {
    const auth = await loginAndGetInfo(0);
    const { token, config } = auth;
    
    // fetch schema
    const res = await fetch(`${config.SUPABASE_URL}/rest/v1/?apikey=${config.API_KEY}`);
    const data = await res.json();
    
    fs.writeFileSync('schema.json', JSON.stringify(data, null, 2));
    console.log("Schema saved to schema.json");
}
test();
