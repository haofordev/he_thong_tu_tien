import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function autoArena() {
    try {
        const accountIndex = 0; // Tài khoản mặc định 0
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log('--- Bắt đầu Tự động Đấu Trường (Độc lập) ---');
        console.log('Tài khoản:', auth.userData.email);
        
        async function runCycle() {
            try {
                const status = await tracker.getArenaStatus(token, charId, config);
                if (!status) return;

                console.log(`\n[${new Date().toLocaleTimeString()}] Kiểm tra Arena...`);
                console.log(`- Lượt đánh còn lại: ${status.attacks_remaining}`);
                console.log(`- Tribute đang chờ: ${status.stats.tribute_available}`);

                // 1. Nhận Tribute nếu có
                if (status.stats.tribute_available > 0) {
                    const collectRes = await tracker.collectArenaTribute(token, charId, config);
                    if (collectRes && collectRes.ok) {
                        console.log(`✅ Đã nhận ${status.stats.tribute_available} điểm Tribute.`);
                    }
                }

                // 2. Tự động đánh nếu còn lượt
                if (status.attacks_remaining > 0) {
                    console.log(`⚔️ Đang tiến hành ${status.attacks_remaining} lượt đánh...`);
                    for (let i = 0; i < status.attacks_remaining; i++) {
                        const opponent = await tracker.findArenaOpponent(token, charId, config);
                        if (opponent && opponent.id) {
                            const fightRes = await tracker.attackArenaOpponent(token, charId, config, opponent.id, opponent.is_npc);
                            if (fightRes && fightRes.ok) {
                                const winMsg = fightRes.win ? 'THẮNG' : 'THUA';
                                console.log(`   [Trận ${i+1}] ${winMsg} kiện tướng: ${opponent.name}`);
                            }
                        }
                        await new Promise(r => setTimeout(r, 2000)); // Nghỉ giữa các trận
                    }
                }

                // 3. Tự động mua đồ trong shop
                const shop = await tracker.getArenaShop(token, charId, config);
                if (shop && shop.items) {
                    const targetItems = ['shop_ngo_dao_thu_weekly', 'ngo_dao_thu', 'shop_dao_tam_dan_weekly', 'dao_tam_dan'];
                    for (const key of targetItems) {
                        const item = shop.items.find(it => it.item_key === key && it.can_afford && (it.purchased_count < it.purchase_limit_count));
                        if (item) {
                            console.log(`🛒 Đang mua ${item.name_vi}...`);
                            const buyRes = await tracker.buyArenaItem(token, charId, config, key);
                            if (buyRes && buyRes.ok) {
                                console.log(`   ✅ Mua thành công!`);
                            }
                        }
                    }
                }

            } catch (e) {
                console.error('Lỗi vòng lặp Arena:', e.message);
            }
        }

        // Chạy lần đầu ngay lập tức
        await runCycle();

        // Sau đó chạy mỗi 2 tiếng một lần để kiểm tra lượt mới
        setInterval(async () => {
            await runCycle();
        }, 7200000);

    } catch (e) {
        console.error('Lỗi khởi động Arena:', e.message);
    }
}

autoArena();
