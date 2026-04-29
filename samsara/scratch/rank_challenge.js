import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function runRankChallenge() {
    try {
        const accountIndex = 0; // Tài khoản chính 0
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log('--- KHỞI CHẠY THỬ THÁCH HẠNG (RANK CHALLENGE) ---');
        console.log('Nhân vật:', charId);
        console.log('Mục tiêu Slot:', 8);

        const TOTAL_ATTEMPTS = 20;
        
        for (let i = 1; i <= TOTAL_ATTEMPTS; i++) {
            console.log(`\n[LẦN ${i}/${TOTAL_ATTEMPTS}] Đang gửi lệnh thách đấu...`);
            
            try {
                const res = await tracker.rpcCall(token, charId, config, 'rpc_nh_rank_challenge', {
                    p_character_id: charId,
                    p_board_code: "lk",
                    p_target_slot: 8
                });

                if (res && res.ok) {
                    console.log(`✅ Kết quả: ${JSON.stringify(res.message || res)}`);
                } else {
                    const errorMsg = res?.message || res?.error_description || "Không thể thách đấu (Hết lượt hoặc đối thủ đã đổi hạng)";
                    console.log(`❌ Thất bại: ${errorMsg}`);
                }
            } catch (err) {
                console.error(`⚠️ Lỗi kết nối ở lần ${i}:`, err.message);
            }

            // Chờ 1 giây giữa mỗi lần gọi để tránh bị server chặn do spam nhanh quá
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n--- HOÀN THÀNH 20 LẦN THÁCH ĐẤU ---');

    } catch (e) {
        console.error('Lỗi khởi động:', e.message);
    }
}

runRankChallenge();
