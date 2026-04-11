import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function compareWithTarget() {
    const targetId = '4ec02430-4d73-43b9-810d-92f53fd5f7d7';
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        const targetProfile = await tracker.rpcCall(token, charId, config, 'rpc_get_character_profile_public', {
            p_character_id: targetId
        });

        console.log('--- Chi tiết Đối thủ: má mày ---');
        console.log('Level:', targetProfile.character.total_level);
        
        // Xem trang bị chi tiết
        console.log('\n[TRANG BỊ]');
        const eq = targetProfile.stats.equipment || {};
        Object.entries(eq).forEach(([slot, item]) => {
            if (item && item.code) {
                console.log(`- ${slot}: ${item.code} (+${item.enhancement_level || 0})`);
            }
        });

        // Xem Công pháp
        console.log('\n[CÔNG PHÁP]');
        const techs = targetProfile.stats.techniques || [];
        techs.forEach(t => {
            console.log(`- ${t.name_vi} (${t.code}) - Cấp ${t.level}`);
        });

        // Xem Linh Căn
        console.log('\n[LINH CĂN]');
        const root = targetProfile.stats.spirit_root || {};
        console.log(`- Hệ chủ đạo: ${root.dominant_element}`);
        console.log(`- Các hệ: Hỏa(${root.fire}), Thủy(${root.water}), Kim(${root.metal}), Thổ(${root.earth}), Mộc(${root.wood})`);

    } catch (e) {
        console.error('Lỗi:', e.message);
    }
}

compareWithTarget();
