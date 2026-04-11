import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkMarket() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Checking Marketplace for Spirit Pills ---');
        // Search for pill_lk_spirit
        const res = await tracker.rpcCall(token, charId, config, 'rpc_nh_market_list', {
            p_character_id: charId,
            p_search_query: 'spirit',
            p_limit: 50,
            p_offset: 0
        });
        
        if (res && res.data) {
            const listings = res.data.filter(l => l.item_code === 'pill_lk_spirit');
            if (listings.length > 0) {
                console.table(listings.map(l => ({
                    Seller: l.character_name,
                    Qty: l.qty,
                    PriceItems: l.price_items,
                    PriceSS: l.price_spirit_stones,
                    ID: l.id
                })));
            } else {
                console.log('Không thấy ai bán pill_lk_spirit.');
                console.log('Dưới đây là một số tin rao vặt gần nhất:');
                console.table(res.data.slice(0, 10).map(l => ({ Name: l.item_name_vi, Code: l.item_code, Price: l.price_spirit_stones })));
            }
        } else {
            console.log('Lỗi truy cập chợ:', res);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

checkMarket();
