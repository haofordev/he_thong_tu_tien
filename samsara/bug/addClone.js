import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
//  CẤU HÌNH CHÍNH
// ============================================================
const API_KEY = 'sb_publishable_vNnNBJooTMczVrWP7qCnhA_479q9nKB';
const BASE_URL = 'https://jeassefmlprfnlszgvbs.supabase.co';
const REGION_CODE = 'bac_vuc';
const DELAY_MS = 10000;

const ITEM_CODE = ["pill_lk_hp", "pill_lk_mp"];

const GIFT_CODES = [
    'VIP666', 'VIP777', 'VIP888', 'VIP999',
    'TATUTIEN', 'TATRUNGSINH', 'SAMSARA2026', "gioto2026", "daile2026"
];

// ─── LOG ────────────────────────────────────────────────────
function log(msg, type = 'info') {
    const now = new Date().toLocaleTimeString('vi-VN');
    const icons = {
        info: 'ℹ️ ',
        success: '✅',
        warning: '⚠️ ',
        error: '❌',
        found: '🎉'
    };
    const icon = icons[type] || icons.info;
    console.log(`[${now}] ${icon} ${msg}`);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── TÊN & EMAIL ────────────────────────────────────────────
function readNames() {
    try {
        const filePath = path.join(__dirname, 'name.txt');
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, 'DaoHuu001\nDaoHuu002\nDaoHuu003');
        }
        return fs.readFileSync(filePath, 'utf8')
            .split('\n').map(n => n.trim()).filter(Boolean);
    } catch (e) { log(`Lỗi đọc name.txt: ${e.message}`, 'error'); return ['TuSia', 'DaoHuu', 'AnDanh']; }
}

function randNum(min, max) {
    const len = Math.floor(Math.random() * (max - min + 1)) + min;
    return Math.floor(Math.random() * Math.pow(10, len)).toString().padStart(len, '0');
}

function slug(name) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '').toLowerCase();
}
function genEmail(name) { return `${slug(name)}${randNum(4, 8)}@gmail.com`; }
function genPassword(name) {
    const s = slug(name);
    return `${s.charAt(0).toUpperCase()}${s.slice(1)}${randNum(4, 6)}.`;
}

function emailUnique(email) {
    try {
        const f = path.join(__dirname, 'clone.txt');
        return !fs.existsSync(f) || !fs.readFileSync(f, 'utf8').includes(email);
    } catch { return true; }
}

function saveAccount(email, password, charName) {
    const line = `${email}:${password}:${charName}\n`;
    fs.appendFileSync(path.join(__dirname, 'clone.txt'), line);
    log(`LƯU → ${email} | ${charName}`, 'found');
}

// ─── API CALLS (BẮT ĐẦU SỬ DỤNG FETCH) ────────────────────────
const HEADERS_BASE = {
    'accept': '*/*',
    'apikey': API_KEY,
    'content-type': 'application/json',
    'x-client-info': 'supabase-flutter/2.12.0',
    'referer': 'https://play.samsaragame.online/'
};

async function registerAccount(email, password) {
    try {
        const res = await fetch(`${BASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: HEADERS_BASE,
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok && data.access_token) return data.access_token;

        const errorDetail = data.msg || data.error_description || JSON.stringify(data);
        log(`Đăng ký thất bại: ${errorDetail}`, 'error');

        const errorMsg = errorDetail.toLowerCase();
        if (errorMsg.includes("rate limit") || errorMsg.includes("too many requests") || res.status === 429) {
            log("🚫 PHÁT HIỆN CHẶN IP. Nghỉ 30 phút để reset...", "warning");
            await sleep(30 * 60 * 1000);
        }
    } catch (e) {
        log(`Lỗi kết nối đăng ký: ${e.message}`, 'error');
    }
    return null;
}

async function createCharacter(token, name) {
    try {
        const res = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_create_character_v3`, {
            method: 'POST',
            headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
            body: JSON.stringify({ p_name: name, p_region_code: REGION_CODE })
        });
        const data = await res.json();
        const charId = data?.character?.id || data?.id;
        if (charId) return charId;

        log(`Tạo nhân vật thất bại: ${JSON.stringify(data)}`, 'error');
    } catch (e) {
        log(`Lỗi kết nối tạo nhân vật: ${e.message}`, 'error');
    }
    return null;
}

async function redeemCode(token, code) {
    try {
        const res = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_redeem_token_code`, {
            method: 'POST',
            headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
            body: JSON.stringify({ p_code: code })
        });
        const data = await res.json();
        return data?.ok || false;
    } catch (e) {
        return false;
    }
}

async function claimMail(token, charId) {
    try {
        const listRes = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_list_mailbox`, {
            method: 'POST',
            headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
            body: JSON.stringify({ p_character_id: charId, p_limit: 50, p_offset: 0 })
        });
        const mails = await listRes.json();
        const giftMails = Array.isArray(mails) ? mails.filter(m => m.has_gift && !m.gift_claimed) : [];

        if (giftMails.length === 0) return;

        log(`Tìm thấy ${giftMails.length} thư có quà. Đang nhận...`);
        for (const mail of giftMails) {
            await fetch(`${BASE_URL}/rest/v1/rpc/rpc_claim_mail_gift_v2`, {
                method: 'POST',
                headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
                body: JSON.stringify({ p_character_id: charId, p_message_id: mail.id })
            });
            await sleep(500);
        }
        log(`Đã nhận hết quà từ thư.`, 'success');
    } catch (e) {
        log(`Lỗi nhận thư: ${e.message}`, 'error');
    }
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

        // Mở rương chỉ cần code, không cần ID
        const containers = items.filter(i => i.item_type === 'container' && i.qty > 0);
        if (containers.length === 0) return;

        log(`Tìm thấy ${containers.length} loại rương quà. Đang mở...`);
        for (const box of containers) {
            try {
                const res = await fetch(`${BASE_URL}/rest/v1/rpc/rpc_open_container_guarded`, {
                    method: 'POST',
                    headers: { ...HEADERS_BASE, authorization: `Bearer ${token}`, 'content-profile': 'public' },
                    body: JSON.stringify({
                        p_character_id: charId,
                        p_container_code: box.code,
                        p_qty: box.qty
                    })
                });
                const data = await res.json();
                if (data?.ok) {
                    log(`Mở thành công: ${box.name} x${box.qty}`, 'success');
                } else {
                    log(`Mở rương lỗi [${box.name}]: ${JSON.stringify(data)}`, 'warning');
                }
            } catch (e) { }
            await sleep(800);
        }
    } catch (e) {
        log(`Lỗi mở rương: ${e.message}`, 'error');
    }
}

// ─── XỬ LÝ 1 ACC ─────────────────────────────────────────────
async function processOne(names) {
    const charName = names[Math.floor(Math.random() * names.length)] + randNum(2, 4);
    let email, tries = 0;
    do { email = genEmail(charName); } while (!emailUnique(email) && ++tries < 20);
    if (tries >= 20) { log('Không tìm được email mới', 'warning'); return false; }

    const password = genPassword(charName);
    log(`Bắt đầu xử lý: ${email} | ${charName}`, 'info');

    const token = await registerAccount(email, password);
    if (!token) return false;
    log('Đăng ký thành công', 'success');

    const charId = await createCharacter(token, charName);
    if (!charId) return false;
    log(`Tạo nhân vật thành công.`, 'success');

    log('Đang nhập gift codes...');
    for (const code of GIFT_CODES) {
        const ok = await redeemCode(token, code);
        process.stdout.write(ok ? `${code} ` : `[FAIL]${code} `);
        await sleep(600);
    }
    console.log('');

    await sleep(1000);
    await claimMail(token, charId);

    await sleep(1000);
    await openAllContainers(token, charId);

    saveAccount(email, password, charName);
    return true;
}

// ─── MAIN ─────────────────────────────────────────────────────
async function main() {
    console.log('\n🌟 AUTO REDEEM & MARKET - TA TRÙNG SINH TẠI TU TIÊN GIỚI 🌟\n');
    log('Quy trình: Đăng ký -> Nhập Code -> Nhận Thư -> Treo Chợ', 'success');

    const names = readNames();
    let total = 0, found = 0;
    while (true) {
        total++;
        log(`─── Lần thứ #${total} (Thành công: ${found}) ───`);
        if (await processOne(names)) found++;
        log(`Nghỉ ${DELAY_MS / 1000}s...`);
        await sleep(DELAY_MS);
    }
}

main().catch(e => { log(`Crash: ${e.message}`, 'error'); process.exit(1); });