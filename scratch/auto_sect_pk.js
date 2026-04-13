import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function autoSectPK() {
    try {
        const accountIndex = 0;
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log('--- Bắt đầu PK TÔNG MÔN (SECT RANK) ---');
        console.log('Nhân vật:', auth.userData.char_name);
        console.log('Mã bảng chuẩn (Cấp 11-20): tc');

        // Thử khiêu chiến các hạng từ 10 xuống 1
        const targetSlots = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];

        for (const slot of targetSlots) {
            console.log(`\n[HẠNG ${slot}] Đang gửi lệnh khiêu chiến...`);

            const res = await tracker.rpcCall(token, charId, config, 'rpc_sect_rank_challenge', {
                p_character_id: charId,
                p_board_code: "lk", // Dùng tc vì đạo hữu cấp 12
                p_target_slot: slot
            });

            if (res && res.ok) {
                const isWin = res.win;
                console.log(`✅ Kết quả: ${isWin ? 'THẮNG' : 'THUA'}`);
                if (isWin) {
                    console.log(`🎊 Chúc mừng! Đạo hữu đã chiếm được Hạng ${slot}!`);
                }
            } else {
                console.log(`❌ Thất bại: ${res.message || 'Hết lượt hoặc không thể khiêu chiến hạng này'}`);
            }

            // Chờ 2 giây để tránh bị chặn
            await new Promise(r => setTimeout(r, 2000));
        }

    } catch (e) {
        console.error('Lỗi khi chạy Sect PK:', e.message);
    }
}

autoSectPK();
