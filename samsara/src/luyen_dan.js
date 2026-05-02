import { loginAndGetInfo, refreshTokenIfNeeded } from './login.js';
import * as tracker from './track.js';


const TIME_RUN = 70

async function luyenDanLoop() {
    const accountIndex = parseInt(process.argv[2] || "0");
    let auth = await loginAndGetInfo(accountIndex);

    console.log(`[HỆ THỐNG] Bắt đầu luyện đan cho: ${auth.userData.email}`);

    //const recipeCode = "r_pill_lk_spirit";
    const recipeCode = "r_pill_lk_hp";

    let time = 0
    while (time < TIME_RUN) {
        try {
            // Check and refresh token
            const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
            if (newAuth) {
                auth = { ...auth, ...newAuth };
                console.log(`[HỆ THỐNG] Đã làm mới token.`);
            }

            const res = await tracker.rpcCall(auth.token, auth.charId, auth.config, 'rpc_craft_auto', {
                p_character_id: auth.charId,
                p_recipe_code: recipeCode,
                p_times: 1
            });

            if (res && res.success) {
                time++;
                console.log(` [${time}/${TIME_RUN}] [LUYỆN ĐAN] Thành công: ${res.message || 'Đã tạo 1 đan dược'}`);
            } else {
                const errorMsg = res?.message || res?.error_description || res?.error || "Lỗi không xác định";
                console.error(`[LUYỆN ĐAN] Thất bại`);

                // Kiểm tra nếu thiếu nguyên liệu
                if (errorMsg.toLowerCase().includes("not_enough_items")) {
                    console.log(`[HỆ THỐNG] Dừng luyện đan do thiếu nguyên liệu.`);
                    break;
                }
            }
        } catch (e) {
            console.error(`[HỆ THỐNG] Lỗi vòng lặp: ${e.message}`);
        }

        // Đợi 3 giây trước lần tiếp theo
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

luyenDanLoop().catch(err => {
    console.error('[CRITICAL ERROR]', err);
});
