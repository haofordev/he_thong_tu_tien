import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkLinhDien() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Kiểm tra Linh Điền (Garden) ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_list_farm_plots', {
            p_character_id: charId
        });
        console.log(JSON.stringify(res, null, 2));

        // Kiểm tra xem có hạt giống nào không
        const invRaw = await tracker.rpcCall(token, charId, config, 'rpc_list_inventory', {
            p_character_id: charId
        });
        const inv = Array.isArray(invRaw) ? invRaw : Object.values(invRaw);
        const seeds = inv.filter(i => i.code.startsWith('seed_'));
        console.log('\nHạt giống hiện có:', seeds.map(s => `${s.name} (x${s.qty})`).join(', ') || 'Không có');

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkLinhDien();
