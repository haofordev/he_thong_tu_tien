import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function compareWithTarget() {
    const targetId = '4ec02430-4d73-43b9-810d-92f53fd5f7d7';
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log(`--- So sánh với nhân vật mục tiêu: ${targetId} ---`);

        // 1. Lấy thông tin công khai của mục tiêu
        const targetProfile = await tracker.rpcCall(token, charId, config, 'rpc_get_character_profile_public', {
            p_character_id: targetId
        });

        const targetBody = await tracker.rpcCall(token, charId, config, 'rpc_get_body_cultivation_public', {
            p_character_id: targetId
        });

        // 2. Lấy thông tin bản thân
        const myProfile = await tracker.getStatus(token, charId, config);
        const myBody = await tracker.getBodyCultivation(token, charId, config);

        console.log('\n[THÔNG TIN CHUNG]');
        console.log(`- Bạn: ${myProfile.home.character.name} (Cấp ${myProfile.home.character.total_level})`);
        console.log(`- Đối thủ: ${targetProfile?.character?.name} (Cấp ${targetProfile?.character?.total_level})`);

        console.log('\n[CHỈ SỐ SINH TỒN]');
        const myStats = myProfile.home.stats.final;
        const targetStats = targetProfile?.stats?.final;
        
        if (targetStats) {
            console.log(`- HP: Bạn(${myStats.hp}) vs Đối thủ(${targetStats.hp}) -> ${targetStats.hp > myStats.hp ? 'Đối thủ cao hơn' : 'Bạn cao hơn'}`);
            console.log(`- Công: Bạn(${myStats.atk}) vs Đối thủ(${targetStats.atk}) -> ${targetStats.atk > myStats.atk ? 'Đối thủ cao hơn' : 'Bạn cao hơn'}`);
            console.log(`- Thủ: Bạn(${myStats.def}) vs Đối thủ(${targetStats.def}) -> ${targetStats.def > myStats.def ? 'Đối thủ cao hơn' : 'Bạn cao hơn'}`);
        }

        console.log('\n[THỂ TU]');
        console.log(`- Bạn: Body Lvl ${myBody?.body_level}, Hệ Hỏa(${myBody?.fire_level})`);
        console.log(`- Đối thủ: Body Lvl ${targetBody?.body_level}, Hệ Hỏa(${targetBody?.fire_level}), Mộc(${targetBody?.wood_level}), Kim(${targetBody?.metal_level}), Thổ(${targetBody?.earth_level}), Thủy(${targetBody?.water_level})`);

        console.log('\n[TRANG BỊ]');
        const targetEq = targetProfile?.stats?.equipment || {};
        console.log('- Đối thủ đang mặc:', Object.keys(targetEq).map(k => `${k}: ${targetEq[k].code}`).join(', '));

    } catch (e) {
        console.error('Lỗi khi so sánh:', e.message);
    }
}

compareWithTarget();
