import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function autoCraft() {
    try {
        const accountIndex = 0; // Tài khoản mặc định 0
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log('--- Bắt đầu Tự động Luyện Đan (Độc lập) ---');
        console.log('Tài khoản:', auth.userData.email);
        console.log('Nhân vật:', charId);

        // Chạy vòng lặp mỗi 3.5 giây (để tránh bị rate limit)
        setInterval(async () => {
            try {
                const res = await tracker.rpcCall(token, charId, config, 'rpc_craft_guarded', {
                    p_character_id: charId,
                    p_recipe_code: "r_pill_lk_spirit",
                    p_times: 1
                });

                if (res && res.ok) {
                    console.log(`[${new Date().toLocaleTimeString()}] ✅ Luyện đan thành công!`);
                } else {
                    const errorMsg = res?.message || res?.error_description || "Hết nguyên liệu hoặc lỗi";
                    console.log(`[${new Date().toLocaleTimeString()}] ❌ Dừng: ${errorMsg}`);
                    
                    // Nếu hết nguyên liệu thì dừng hẳn
                    if (errorMsg.includes("không đủ") || errorMsg.includes("thiếu") || errorMsg.includes("insufficient")) {
                        console.log('Hệ thống dừng do thiếu nguyên liệu.');
                        process.exit(0);
                    }
                }
            } catch (e) {
                console.error('Lỗi khi gọi API:', e.message);
            }
        }, 3500);

    } catch (e) {
        console.error('Lỗi khởi động:', e.message);
    }
}

autoCraft();
