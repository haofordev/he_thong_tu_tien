import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';

async function checkInventory() {
    try {
        const { token, charId, config } = await loginAndGetInfo();
        const items = await tracker.listInventory(token, charId, config);

        if (!Array.isArray(items)) {
            console.log('Không thể lấy danh sách túi đồ.');
            return;
        }

        const chests = items.filter(item => 
            item.code.startsWith('chest_') || item.code.includes('mob_chest')
        );

        console.log(`\n=== DANH SÁCH TÚI ĐỒ (${items.length} vật phẩm) ===`);
        items.forEach(item => {
            const isChest = item.code.startsWith('chest_') || item.code.includes('mob_chest');
            const marker = isChest ? ' [RƯƠNG!]' : '';
            console.log(`- ${item.name} (${item.code}): ${item.qty}${marker}`);
        });

        if (chests.length > 0) {
            console.log(`\n>>> Phát hiện ${chests.length} loại rương cần mở!`);
        } else {
            console.log('\n>>> Không tìm thấy rương nào.');
        }

    } catch (err) {
        console.error('Lỗi Check:', err.message);
    }
}

checkInventory();
