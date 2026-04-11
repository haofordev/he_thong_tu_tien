import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function autoUpgradeBody() {
    try {
        const auth = await loginAndGetInfo(0); // Tài khoản 0
        const { token, charId, config } = auth;

        console.log('--- Đang kiểm tra và nâng cấp Thể Tu ---');
        
        const currentBody = await tracker.getBodyCultivation(token, charId, config);
        if (!currentBody) return;

        const elements = ['metal', 'wood', 'water', 'earth', 'fire'];
        
        for (const el of elements) {
            const currentLevel = currentBody[`${el}_level`] || 0;
            if (currentLevel === 0) {
                console.log(`Đang nâng cấp hệ ${el.toUpperCase()} lên cấp 1...`);
                // Check if we have stones
                // Note: user has 1000+ SS, level 1 cost is 5, very cheap.
                // Assuming they have at least 1 stone of each type (usually starts with some).
                const res = await tracker.upgradeBodyElement(token, charId, config, el);
                if (res && res.ok) {
                    console.log(`✅ Thành công nâng hệ ${el} lên cấp 1!`);
                } else {
                    console.log(`❌ Thất bại nâng hệ ${el}: ${res?.message || 'Có lẽ thiếu Linh thạch thuộc tính (Stone)'}`);
                }
            } else {
                console.log(`Hệ ${el} đã đạt cấp ${currentLevel}. Bỏ qua.`);
            }
        }

        // Sau khi nâng cấp, xem trạng thái mới
        const finalBody = await tracker.getBodyCultivation(token, charId, config);
        console.log('\n--- Trạng thái Thể Tu Mới ---');
        console.log(`Body Level (Hòa Hợp): ${finalBody.body_level}`);
        console.log(`Hệ: Hỏa(${finalBody.fire_level}), Mộc(${finalBody.wood_level}), Kim(${finalBody.metal_level}), Thổ(${finalBody.earth_level}), Thủy(${finalBody.water_level})`);
        console.log(`Chỉ số hiện tại: HP(${finalBody.hp}), Công(${finalBody.atk}), Thủ(${finalBody.def})`);

    } catch (e) {
        console.error('Lỗi nâng cấp:', e.message);
    }
}

autoUpgradeBody();
