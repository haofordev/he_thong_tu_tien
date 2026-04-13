import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function performUpgrade() {
    try {
        const auth = await loginAndGetInfo(0);
        console.log(`[HỆ THỐNG] Đang kiểm tra Luyện Thể cho: ${auth.userData.email}`);

        // 1. Lấy thông tin hiện tại
        const body = await tracker.getBodyCultivation(auth.token, auth.charId, auth.config);
        console.log(`[TRẠNG THÁI] Linh thạch: ${body.spirit_stones}`);
        
        const elements = ['fire', 'metal', 'water', 'earth', 'wood'];
        
        // 2. Chuyển đá từ túi vào bảng Thể Tu (Nếu có lệnh)
        // Lưu ý: Hiện tại game có thể yêu cầu dùng đá từ túi trước.
        // Tôi sẽ thử dùng hàm upgrade trực tiếp, nếu thiếu đá server sẽ báo lỗi chi tiết.

        let totalUpgrades = 0;
        let continueUpgrading = true;

        while (continueUpgrading && totalUpgrades < 20) {
            continueUpgrading = false;
            
            // Cập nhật lại dữ liệu mỗi vòng
            const currentBody = await tracker.getBodyCultivation(auth.token, auth.charId, auth.config);
            
            // Ưu tiên nâng cấp: FIRE > METAL > WATER > EARTH > WOOD
            for (const el of elements) {
                const cost = currentBody.next_upgrade_cost[el];
                
                // Kiểm tra Linh thạch và Đá trong bảng Thể tu
                const stoneKey = el === 'fire' ? 'hoa_linh_thach' : 
                                 el === 'wood' ? 'moc_linh_thach' : 
                                 el === 'water' ? 'thuy_linh_thach' : 
                                 el === 'earth' ? 'tho_linh_thach' : 'kim_linh_thach';
                
                const hasStonesInTab = currentBody.stones[stoneKey] || 0;

                if (currentBody.spirit_stones >= cost.ss_cost && hasStonesInTab >= cost.stone_cost) {
                    console.log(`[TIẾN TRÌNH] Đang nâng ${el.toUpperCase()} (Tốn: ${cost.ss_cost} SS, ${cost.stone_cost} Đá)`);
                    const res = await tracker.upgradeBodyElement(auth.token, auth.charId, auth.config, el);
                    
                    if (res.ok) {
                        console.log(`✅ Thành công! ${el.toUpperCase()} cấp mới.`);
                        totalUpgrades++;
                        continueUpgrading = true;
                        break; // Quay lại vòng lặp để cập nhật stats mới
                    } else {
                        console.log(`❌ Thất bại ${el.toUpperCase()}: ${res.message || 'Lỗi server'}`);
                    }
                }
            }
        }

        if (totalUpgrades === 0) {
            console.log('[HỆ THỐNG] Không thể nâng thêm cấp nào. Hãy farm thêm Linh thạch hoặc Đá ngũ hành.');
        } else {
            console.log(`[HỆ THỐNG] Tổng cộng đã nâng ${totalUpgrades} cấp!`);
        }

    } catch (e) {
        console.error('[LỖI FATAL]', e.message);
    }
}

performUpgrade();
