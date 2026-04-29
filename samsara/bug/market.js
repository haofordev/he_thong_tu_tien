import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export async function getMarketList(token, charId, config, floor = 1, category = null, limit = 80, offset = 0) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_nh_market_list`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_floor: floor,
                p_category: category,
                p_sort: "recent",
                p_limit: limit,
                p_offset: offset
            })
        });
        return await res.json();
    } catch (e) {
        console.error('[MARKET LIST ERROR]', e.message);
    }
    return null;
}

export async function buyListing(token, charId, config, listingId) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_nh_market_buy_listing`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_listing_id: listingId
            })
        });
        const data = await res.json().catch(() => null);
        return { data, ok: res.ok };
    } catch (e) {
        console.error('[MARKET BUY ERROR]', e.message);
    }
    return null;
}

export async function autoBuyMarketItems(token, charId, config, targetItemCodes = [], maxPrice = 1) {
    const categories = [null, 'consumable', 'material', 'equipment', 'talisman', 'formation'];

    for (const cat of categories) {
        console.log(`[CHỢ ĐEN] Quét loại: ${cat || 'TẤT CẢ'} (Max Price: ${maxPrice})...`);
        for (let floor = 1; floor <= 2; floor++) {
            const list = await getMarketList(token, charId, config, floor, cat);

            if (!list || !Array.isArray(list)) {
                // console.log(`[CHỢ ĐEN] KQ không phải array: ${JSON.stringify(list)}`);
                continue;
            }

            if (list.length === 0) continue;

            let buyableItems = list.filter(item => {
                if (item.is_mine) return false;
                if (item.price_spirit_stones > maxPrice) return false;
                if (targetItemCodes.length > 0 && !targetItemCodes.includes(item.item_code)) return false;
                return true;
            });

            if (buyableItems.length > 0) {
                console.log(`[CHỢ ĐEN] Loại: ${cat || 'TẤT CẢ'} | Floor: ${floor} | Tổng: ${list.length} | Hợp lệ: ${buyableItems.length}`);
                for (const item of buyableItems) {
                    process.stdout.write(`Đang mua [${item.item_name}] giá ${item.price_spirit_stones}... `);
                    const buyRes = await buyListing(token, charId, config, item.id);
                    if (buyRes && buyRes.ok) {
                        console.log(`Thành công!`);
                    } else {
                        console.log(`Thất bại! (${JSON.stringify(buyRes?.data)})`);
                    }
                    await new Promise(r => setTimeout(r, 500));
                }
            }
        }
    }
}

// === PHẦN BỔ SUNG: ĐĂNG NHẬP VÀ RUN ĐỘC LẬP TỪ CLI ===
export async function loginWithEmailPass(email, password, config) {
    const authRes = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            password: password,
            gotrue_meta_security: { captcha_token: null },
        }),
    });
    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(`Đăng nhập thất bại: ${authData.error_description || authData.error}`);
    const token = authData.access_token;

    const charRes = await fetch(`${config.SUPABASE_URL}/rest/v1/characters?select=id,name&limit=1`, {
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
        }
    });

    const charData = await charRes.json();
    if (!charRes.ok || !charData[0]) throw new Error(`Không lấy được thông tin nhân vật`);
    const charId = charData[0].id;
    return { token, charId };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function run(email, password, maxPrice = 1, itemCode = null) {
    if (!email || !password) {
        console.log("Thiếu email hoặc mật khẩu.");
        return;
    }

    const targetItemCodes = Array.isArray(itemCode) ? itemCode : (itemCode ? [itemCode] : []);
    const configPath = path.resolve(__dirname, '../data/config.json');

    let config;
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error("Không tìm thấy file config.json tại data/config.json");
        return;
    }

    try {
        console.log(`[AUTH] Đang đăng nhập với email: ${email}`);
        const { token, charId } = await loginWithEmailPass(email, password, config);

        // Lấy thông tin nhân vật để xem Region chính xác
        const charInfoRes = await fetch(`${config.SUPABASE_URL}/rest/v1/characters?select=name,region_code&id=eq.${charId}`, {
            headers: { 'apikey': config.API_KEY, 'Authorization': `Bearer ${token}` }
        });
        const charInfo = await charInfoRes.json();
        const region = charInfo[0]?.region_code || "Không rõ";

        // Lấy số dư Linh Thạch
        const walletRes = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_character_wallet`, {
            method: 'POST',
            headers: { 'apikey': config.API_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_character_id: charId })
        });
        const wallet = await walletRes.json();
        const balance = wallet?.spirit_stones ?? 0;

        console.log(`[AUTH] Nhân vật: ${charInfo[0]?.name || charId} | Region: ${region} | Số dư: ${balance} LT`);
        console.log(`[AUTH] Bắt đầu scan chợ (2 giây/lần), mua mọi thứ <= ${maxPrice} linh thạch...`);

        // Loop 2 giây quét 1 lần để hốt đồ clone nhanh nhất có thể
        setInterval(() => {
            autoBuyMarketItems(token, charId, config, targetItemCodes, maxPrice);
        }, 2000);

        // Lần chạy đầu tiên
        await autoBuyMarketItems(token, charId, config, targetItemCodes, maxPrice);
    } catch (e) {
        console.error(e.message);
    }
}

const EMAIL = "vosongkiemton38@gmail.com";
const PASSWORD = "Vosongkiemton822.";
const MAX_PRICE = 20;
const ITEM_CODE = null;
run(EMAIL, PASSWORD, MAX_PRICE, ITEM_CODE);