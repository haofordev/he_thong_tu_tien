import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loginWithEmailPass(email, password, config) {
    const authRes = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': config.API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, gotrue_meta_security: { captcha_token: null } }),
    });
    const authData = await authRes.json();
    const token = authData.access_token;
    const charRes = await fetch(`${config.SUPABASE_URL}/rest/v1/characters?select=id&limit=1`, {
        headers: { 'apikey': config.API_KEY, 'Authorization': `Bearer ${token}` }
    });
    const charData = await charRes.json();
    return { token, charId: charData[0].id };
}

async function buyDirect(token, charId, config, listingId) {
    const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_nh_market_buy_listing`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'content-profile': 'public'
        },
        body: JSON.stringify({ p_character_id: charId, p_listing_id: listingId })
    });
    const data = await res.json();
    console.log("Kết quả mua trực tiếp:", JSON.stringify(data, null, 2));
}

async function start() {
    const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/config.json'), 'utf8'));
    const { token, charId } = await loginWithEmailPass("vosongkiemton38@gmail.com", "Vosongkiemton822.", config);
    const listingId = "ab5c5b9c-9992-4379-9c05-0a3812a900e7"; // Listing ID vừa lấy được
    console.log(`Đang thử mua trực tiếp Listing ID: ${listingId}`);
    await buyDirect(token, charId, config, listingId);
}

start();
