// check_linh_thuy.js
// This script logs the quantity of "linh thủy 30 năm" items in your inventory.
// It uses the existing login and tracker modules.

import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';

async function checkLinhThuy() {
    try {
        // Login and obtain token, character ID, and config
        const { token, charId, config } = await loginAndGetInfo();
        // Get full inventory
        const inventory = await tracker.listInventory(token, charId, config);
        if (!Array.isArray(inventory)) {
            console.log('Không thể lấy danh sách túi đồ.');
            return;
        }
        // Filter items that match the name "linh thủy 30 năm" (case‑insensitive)
        const targetItems = inventory.filter(item =>
            (item.name && item.name.toLowerCase().includes('linh thủy')) ||
            (item.code && item.code.toLowerCase().includes('linh_thuy'))
        );
        const totalQty = targetItems.reduce((sum, it) => sum + (it.qty || 0), 0);
        console.log(`\n=== KẾT QUẢ: Bạn có ${totalQty} "linh thủy 30 năm" trong túi đồ ===`);
        if (targetItems.length > 0) {
            console.log('Chi tiết các mục tìm được:');
            targetItems.forEach(it => console.log(`- ${it.name} (${it.code}): ${it.qty}`));
        } else {
            console.log('Không tìm thấy mục "linh thủy 30 năm" trong túi đồ.');
        }
    } catch (err) {
        console.error('Lỗi khi kiểm tra linh thủy:', err.message);
    }
}

// Run the check when this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    checkLinhThuy();
}

export { checkLinhThuy };
