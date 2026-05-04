import { loginAndGetInfo, refreshTokenIfNeeded } from '../src/login.js';
import * as tracker from '../src/track.js';

function isMaxTalentReached(talent) {
    return Object.values(talent)
        .filter(v => typeof v === 'number')
        .some(v => v >= 30);
}

async function luyenDanLoop() {
    const accountIndex = parseInt(process.argv[2] || "0");
    let auth = await loginAndGetInfo(accountIndex);

    console.log(`[HỆ THỐNG] Bắt đầu luyện đan cho: ${auth.userData.email}`);

    while (true) {
        try {
            // refresh token
            const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
            if (newAuth) {
                auth = { ...auth, ...newAuth };
                console.log(`[HỆ THỐNG] Đã làm mới token.`);
            }

            const res = await tracker.rpcCall(
                auth.token,
                auth.charId,
                auth.config,
                'rpc_reset_origin',
                {
                    p_character_id: auth.charId,
                    p_token_type: "copper",
                }
            );


            const talent = res?.talent;

            if (!talent) {
                console.log(`[WARN] Không lấy được talent`);
                continue;
            }

            console.log(`[TALENT]`, talent);

            // 🚀 CHECK DỪNG
            if (isMaxTalentReached(talent)) {
                console.log(`🎉 Đã đạt >= 30 ở một hệ → DỪNG AUTO`);
                break;
            }

        } catch (e) {
            console.error(`[HỆ THỐNG] Lỗi vòng lặp: ${e.message}`);
        }

        // delay 0.5s (bạn đang để 500ms chứ không phải 3s)
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

luyenDanLoop().catch(err => {
    console.error('[CRITICAL ERROR]', err);
});