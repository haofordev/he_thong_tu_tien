import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkSectShop() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Checking Sect Shop (Floor 1) ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_sect_institute_shop_list_offers', {
            p_character_id: charId,
            p_shop_code: 'sect_institute_shop',
            p_floor: 1
        });
        
        if (res && res.data) {
           console.table(res.data.map(o => ({
               item: o.item_code,
               price: `${o.spirit_stones_cost} stones / ${o.contribution_cost} contrib`,
               stock: o.stock
           })));
        } else {
            console.log('No items found or access denied:', JSON.stringify(res, null, 2));
        }

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkSectShop();
