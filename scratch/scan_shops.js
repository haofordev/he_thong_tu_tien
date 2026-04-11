import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function scanShops() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        const shops = [
            { code: 'normal_shop', name: 'Tiệm Tạp Hóa' },
            { code: 'sect_institute_shop', name: 'Tiệm Tông Môn', floor: 1 },
            { code: 'sect_institute_shop', name: 'Tiệm Tông Môn', floor: 2 },
            { code: 'arena_shop', name: 'Tiệm Đấu Trường' }
        ];

        for (const shop of shops) {
            console.log(`\n--- ${shop.name} (${shop.code}) ---`);
            const rpc = shop.code === 'arena_shop' ? 'rpc_arena_shop_list' : 'rpc_sect_institute_shop_list_offers';
            
            const payload = { p_character_id: charId };
            if (shop.code !== 'arena_shop') {
                payload.p_shop_code = shop.code;
                payload.p_floor = shop.floor || 1;
            }

            const res = await tracker.rpcCall(token, charId, config, rpc, payload);
            
            if (res && (res.data || (Array.isArray(res) && res.length > 0))) {
                const items = res.data || res;
                console.table(items.map(o => ({
                    Item: o.item_name_vi || o.item_code,
                    Code: o.item_code,
                    Price: o.spirit_stones_cost || o.cost_spirit_stones || o.cost_merit || '?'
                })));
            } else {
                console.log('Không có hàng hoặc không vào được.');
            }
        }

    } catch (e) {
        console.error('Scan Error:', e);
    }
}

scanShops();
