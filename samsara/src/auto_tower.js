import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';

async function autoTower() {
    const accountIndex = parseInt(process.argv[2] || "0");
    let auth = await loginAndGetInfo(accountIndex);
    const { token, charId, config, userData } = auth;

    console.log(`[THÁP] Bắt đầu leo tháp cho: ${userData.email} - Nhân vật ID: ${charId.substring(0, 8)}`);

    while (true) {
        // 1. Lấy trạng thái tháp hiện tại
        let statusRes;
        try {
            const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_tower_get_status`, {
                method: 'POST',
                headers: {
                    'apikey': config.API_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'content-profile': 'public'
                },
                body: JSON.stringify({
                    p_character_id: charId
                })
            });
            statusRes = await res.json();
            
            if (!res.ok) {
                console.error(`[THÁP] Lỗi lấy trạng thái: ${statusRes.message || res.statusText}`);
                break;
            }
        } catch (e) {
            console.error(`[THÁP] Lỗi kết nối khi lấy trạng thái: ${e.message}`);
            break;
        }

        if (!statusRes || !statusRes.ok) {
            console.error(`[THÁP] Không thể lấy thông tin tháp!`);
            break;
        }

        const highestCleared = statusRes.highest_cleared || 0;
        const targetFloor = highestCleared + 1;
        const maxFloors = statusRes.max_floors || 150;

        if (targetFloor > maxFloors) {
            console.log(`[THÁP] Chúc mừng! Đã vượt qua tầng cao nhất (${maxFloors}).`);
            break;
        }

        console.log(`[THÁP] Đang khiêu chiến tầng ${targetFloor}...`);

        // 2. Khiêu chiến tầng tiếp theo
        let challengeRes;
        try {
            const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_tower_challenge_floor`, {
                method: 'POST',
                headers: {
                    'apikey': config.API_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'content-profile': 'public'
                },
                body: JSON.stringify({
                    p_character_id: charId,
                    p_floor_number: targetFloor
                })
            });
            challengeRes = await res.json();

            if (!res.ok) {
                console.error(`[THÁP] Lỗi khiêu chiến: ${challengeRes.message || res.statusText}`);
                break;
            }
        } catch (e) {
            console.error(`[THÁP] Lỗi kết nối khi đánh tháp: ${e.message}`);
            break;
        }

        if (challengeRes && challengeRes.ok) {
            if (challengeRes.result === 'victory') {
                const totalStones = challengeRes.rewards?.total_spirit_stones || 0;
                console.log(`   ✅ [THẮNG] Đã vượt qua tầng ${targetFloor}! (Còn lại HP: ${challengeRes.player_hp}/${challengeRes.player_max_hp}) - Nhận: ${totalStones} Linh thạch.`);
                
                // Đợi 2s trước khi đánh tầng tiếp theo
                await new Promise(r => setTimeout(r, 2000));
            } else if (challengeRes.result === 'defeat') {
                console.log(`   ❌ [THUA] Thất bại tại tầng ${targetFloor}. Boss còn ${challengeRes.guardian_hp}/${challengeRes.guardian_max_hp} HP.`);
                console.log(`[THÁP] Dừng tool vì không đánh lại boss.`);
                break;
            } else {
                console.log(`   ⚠️ [KHÔNG RÕ] Kết quả: ${challengeRes.result}. Dừng tool.`);
                break;
            }
        } else {
            console.error(`[THÁP] Không thể khiêu chiến: ${challengeRes.message || challengeRes.reason || JSON.stringify(challengeRes)}`);
            break;
        }
    }

    console.log(`[THÁP] Kết thúc leo tháp.`);
    process.exit(0);
}

autoTower();
