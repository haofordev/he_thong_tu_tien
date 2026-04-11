import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkSectShop() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Checking Sect Shop Floors ---');
        for (let floor = 1; floor <= 3; floor++) {
            const res = await tracker.rpcCall(token, charId, config, 'rpc_sect_institute_shop_list_offers', {
                p_character_id: charId,
                p_shop_code: 'sect_institute_shop',
                p_floor: floor
            });
            
            if (res && res.data) {
                console.log(`\n[Tầng ${floor}]`);
                console.table(res.data.map(o => ({
                    Name: o.item_name_vi || o.item_code,
                    Price: o.spirit_stones_cost,
                    Contrib: o.contribution_cost,
                    Stock: o.stock
                })));
            } else {
                console.log(`[Tầng ${floor}] Lỗi hoặc không có hàng:`, res?.message || 'Unknown');
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

checkSectShop();
