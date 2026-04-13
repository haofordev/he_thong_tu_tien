import { loginAndGetInfo } from './src/login.js';
import * as tracker from './src/track.js';

async function goOffline(mapCode) {
    try {
        const { token, charId, config } = await loginAndGetInfo(0);
        const targetMap = mapCode || "starter_01";
        
        console.log(`\n[HỆ THỐNG] Đang chuẩn bị chuyển sang chế độ Offline AFK...`);
        console.log(`[HỆ THỐNG] Map chỉ định: ${targetMap}`);

        const res = await tracker.startOfflineAFK(token, charId, config, targetMap);
        
        if (res && (res.ok || res.message?.includes('thành công') || res.realm_code)) {
            console.log(`\n[THÀNH CÔNG] Nhân vật đã bắt đầu Treo máy Ngoại tuyến tại: ${targetMap}`);
            console.log(`[HỆ THỐNG] Bạn có thể tắt máy và đi nghỉ, điểm diệt quái sẽ tự tăng!`);
        } else {
            console.log(`\n[THẤT BẠI] Không thể vào chế độ Offline:`, JSON.stringify(res));
        }

    } catch (err) {
        console.error('\nLỗi kích hoạt Offline:', err.message);
    }
}

// Lấy tham số map từ dòng lệnh: node go_offline.js sect_lk_c03
const mapArg = process.argv[2];
goOffline(mapArg);
