import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';

let latestMsg = "Đang khởi tạo...";
let bossMsg = "Đang tìm mục tiêu...";
let currentRealmId = null;
let currentMobId = null;
let scanCount = 0; // Đếm số lần quét hụt

async function startCombatLoop(token, charId, config) {
    // 1. Nếu không có mục tiêu, tiến hành thám thính
    if (!currentMobId) {
        scanCount++;
        bossMsg = `Chưa có mục tiêu. Đang quét Bí Cảnh (Lần ${scanCount})...`;

        try {
            // Thử lấy snapshot mới
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, currentRealmId);
            currentMobId = bicanh.findNewTarget(snapshot);

            // Nếu quét 5 lần vẫn không có quái, thử xin vào lại Bí Cảnh (Reset Realm)
            if (!currentMobId && scanCount >= 5) {
                bossMsg = "Bí Cảnh trống hoặc lỗi Realm. Đang tiến hành vào lại...";
                const realmData = await bicanh.joinSecretRealm(token, charId, config, "starter_01");
                currentRealmId = realmData?.id || currentRealmId;
                scanCount = 0; // Reset đếm
            }
        } catch (e) {
            bossMsg = "Lỗi kết nối Bí Cảnh. Đang thử lại...";
        }

        setTimeout(() => startCombatLoop(token, charId, config), 5000); // Chờ 5s quét lại
        return;
    }

    // 2. Nếu đã có mục tiêu, tiến hành tấn công
    try {
        const res = await bicanh.attackMob(token, charId, config, currentRealmId, currentMobId);
        let nextWait = 3200;

        if (res && res.ok) {
            scanCount = 0; // Reset đếm khi có mục tiêu chuẩn
            const critLabel = res.is_crit ? "[BẠO KÍCH!] " : "";
            bossMsg = `${critLabel}Gây: -${res.damage} HP | Boss còn: ${res.mob_hp_after}\n > Nhân vật: HP: ${res.hp_after} | MP: ${res.mp_after}`;

            if (res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;

            if (res.mob_hp_after <= 0) {
                bossMsg = `[!] Boss đã tử trận! Đang tìm mục tiêu mới...`;
                currentMobId = null; // Để vòng lặp sau tự động quét lại
                nextWait = 1000;
            }
        } else {
            // Nếu lỗi (Ví dụ: "Mob not found")
            bossMsg = `[!] Lỗi: ${res?.message || "Mục tiêu không hợp lệ"}.`;
            currentMobId = null;
            nextWait = 2000;
        }

        setTimeout(() => startCombatLoop(token, charId, config), nextWait);

    } catch (e) {
        bossMsg = `Lỗi kết nối: ${e.message}`;
        currentMobId = null;
        setTimeout(() => startCombatLoop(token, charId, config), 5000);
    }
}

// Giữ nguyên hàm start() và các vòng lặp khác...
// Chú ý: Nhớ gọi startCombatLoop(token, charId, config) trong hàm start()

async function start() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        // Khởi tạo Bí Cảnh
        const realmData = await bicanh.joinSecretRealm(token, charId, config, "starter_01");
        currentRealmId = realmData?.id;

        // Khởi tạo Kỳ Ngộ
        await kyngo.enterKiNgo(token, charId, config);
        latestMsg = await kyngo.getLatestLog(token, charId, config);

        // Bắt đầu vòng lặp chiến đấu
        startCombatLoop(token, charId, config);

        // Vòng lặp Dashboard (3s)
        setInterval(async () => {
            try {
                const data = await tracker.getStatus(token, charId, config);
                if (!data || !data.cultivation_status) return;

                const status = data.cultivation_status;
                const totalExp = status.cultivation_exp_progress + status.claimable_exp;

                console.clear();
                console.log(`===========================================================`);
                console.log(`   SAMSARA SUPREME BOT v4.7 - OPTIMIZED RECURSION         `);
                console.log(`===========================================================`);
                console.log(` Đạo hữu:    ${data.home.character.name}`);
                console.log(` Cảnh giới:  ${data.home.stats.base.realm_name}`);
                console.log(`-----------------------------------------------------------`);
                console.log(` EXP Hiện tại: ${status.cultivation_exp_progress} / ${status.exp_to_next}`);
                console.log(` EXP Chờ nhận: ${status.claimable_exp}`);
                console.log(` Tiến độ:      ${((totalExp / status.exp_to_next) * 100).toFixed(2)}%`);
                console.log(`-----------------------------------------------------------`);
                console.log(` [CHIẾN ĐẤU BÍ CẢNH]:`);
                console.log(` > ${bossMsg}`);
                console.log(`-----------------------------------------------------------`);
                console.log(` [CƠ DUYÊN KỲ NGỘ]:`);
                console.log(` > ${latestMsg}`);
                console.log(`-----------------------------------------------------------`);

                if (totalExp >= status.exp_to_next) {
                    await tracker.claimExp(token, charId, config);
                }
                console.log(` Cập nhật lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`===========================================================`);
            } catch (e) { }
        }, 3000);

        // Vòng lặp Kỳ Ngộ (121s)
        setInterval(async () => {
            await kyngo.triggerKiNgo(token, charId, config);
            setTimeout(async () => {
                latestMsg = await kyngo.getLatestLog(token, charId, config);
            }, 2000);
        }, 121000);

    } catch (err) {
        console.error('[CRITICAL ERROR]', err.message);
    }
}

start();