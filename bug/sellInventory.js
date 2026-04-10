import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../data/config.json');
const clonePath = path.resolve(__dirname, 'clone.txt');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const BASE_URL = config.SUPABASE_URL;
const HEADERS_BASE = {
    'apikey': config.API_KEY,
    'Content-Type': 'application/json',
    'x-client-info': 'supabase-flutter/2.12.0',
};

function log(msg, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    let icon = 'ℹ️ ';
    if (type === 'success') icon = '✅ ';
    if (type === 'error') icon = '❌ ';
    if (type === 'warning') icon = '⚠️ ';
    console.log(`[${timestamp}] ${icon} ${msg}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function login(email, password) {
    try {
        const res = await fetch(`${BASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: HEADERS_BASE,
            body: JSON.stringify({ email, password, gotrue_meta_security: { captcha_token: null } })
        });
        const data = await res.json();
        if (res.ok) return data.access_token;
        log(`Login thất bại [${email}]: ${data.error_description || data.error}`, 'error');
    } catch (e) { log(`Lỗi kết nối login: ${e.message}`, 'error'); }
    return null;
}

async function getCharId(token) {
    try {
        const res = await fetch(`${BASE_URL}/rest/v1/characters?select=id&limit=1`, {
            headers: { ...HEADERS_BASE, authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        return data[0]?.id;
    } catch (e) { return null; }
}

async function openAllContainers(token, charId) {
    try {
        const invRes = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_list_inventory`, {
            method: 'POST',
            headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
            body: JSON.stringify({ p_character_id: charId, p_locale: "vi" })
        });
        const items = await invRes.json();
        if (!Array.isArray(items)) return;

        const containers = items.filter(i => i.item_type === 'container' && i.qty > 0);
        for (const box of containers) {
            await fetch(`${BASE_URL}/rest/v1/rpc/rpc_open_container_guarded`, {
                method: 'POST',
                headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
                body: JSON.stringify({ p_character_id: charId, p_container_code: box.code, p_qty: box.qty })
            });
            log(`Mở rương: ${box.name}`, 'success');
            await sleep(500);
        }
    } catch (e) { }
}

async function sellItems(token, charId) {
    try {
        const invRes = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_list_inventory`, {
            method: 'POST',
            headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
            body: JSON.stringify({ p_character_id: charId, p_locale: "vi" })
        });
        const items = await invRes.json();
        if (!Array.isArray(items)) return;

        // Bán HP/MP hoặc đồ Rare+ (theo nhu cầu)
        const sellableItems = items.filter(i => i.qty > 0 && (i.code === 'pill_lk_hp' || i.code === 'pill_lk_mp' || i.rarity !== 'common'));

        for (const item of sellableItems) {
            const res = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_nh_market_create_listing`, {
                method: 'POST',
                headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
                body: JSON.stringify({
                    p_character_id: charId,
                    p_item_code: item.code,
                    p_qty: item.qty,
                    p_price_spirit_stones: 1,
                    p_instance_id: item.id || null
                })
            });
            const data = await res.json();
            if (data?.ok) log(`Treo bán: ${item.name} x${item.qty}`, 'success');
            await sleep(800);
        }
    } catch (e) { }
}

async function main() {
    if (!fs.existsSync(clonePath)) {
        log("Không tìm thấy file clone.txt", "error");
        return;
    }

    const lines = fs.readFileSync(clonePath, 'utf8').split('\n').filter(l => l.includes(':'));
    log(`Bắt đầu xử lý ${lines.length} tài khoản từ clone.txt...`);

    for (const line of lines) {
        const [email, pass] = line.split(':').map(s => s.trim());
        log(`Đang xử lý: ${email}`);

        const token = await login(email, pass);
        if (!token) continue;

        const charId = await getCharId(token);
        if (!charId) continue;

        await openAllContainers(token, charId);
        await sellItems(token, charId);

        log(`Xong: ${email}`, 'success');
        await sleep(1000);
    }
    log("Hoàn thành quét tất cả clone!", "success");
}

main();
