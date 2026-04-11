import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function stopPuppet() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        // 1. Lấy danh sách để tìm Puppet ID
        const puppetData = await tracker.rpcCall(token, charId, config, 'rpc_get_puppets', {
            p_character_id: charId
        });
        
        const activePuppet = puppetData?.puppets?.find(p => p.active_farm);
        
        if (activePuppet) {
            console.log(`Đang dừng Rối: ${activePuppet.puppet_id} ...`);
            const res = await tracker.rpcCall(token, charId, config, 'rpc_claim_puppet_farm', {
                p_puppet_id: activePuppet.puppet_id
            });
            console.log('Kết quả:', JSON.stringify(res, null, 2));
        } else {
            console.log('Không có Rối nào đang farm.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

stopPuppet();
