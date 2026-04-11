import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkStatues() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Kiểm tra Tượng Đài (Statues) ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_get_statue_snapshot', {
            p_character_id: charId
        });
        
        if (res && res.statues) {
            console.log('Điểm Tượng hiện có:', res.wallet?.balance || 0);
            console.log('\nDanh sách tượng:');
            res.statues.forEach(s => {
                const effects = s.effects ? JSON.stringify(s.effects) : 'Chưa có';
                console.log(`- ${s.name_vi} (Cấp ${s.level}): ${effects}`);
                if (s.next_upgrade) {
                   console.log(`  -> Yêu cầu nâng cấp: ${s.next_upgrade.cost_points} điểm (Tỷ lệ: ${s.next_upgrade.success_pct}%)`);
                }
            });
        } else {
            console.log('Không lấy được dữ liệu tượng:', JSON.stringify(res, null, 2));
        }

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkStatues();
