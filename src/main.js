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
    // 1. Nếu không có mục tiêu, thám thính
    if (!currentMobId) {
        try {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, currentRealmId);
            const target = bicanh.findNewTarget(snapshot, charId);

            if (target) {
                currentMobId = target.id;
                scanCount = 0;
                const rangeLabel = target.inRange ? "" : ` [NGOÀI TẦM: ${Math.round(target.distance)}px]`;
                process.stdout.write(`\r[BÍ CẢNH] Nhắm: ${currentMobId.substring(0, 8)}...${rangeLabel}          `);
            } else {
                scanCount++;
                bossMsg = `Không tìm thấy bất kỳ quái nào. Đang quét lại... (Lần ${scanCount})`;
            }

            if (scanCount >= 5) {
                bossMsg = "Vùng thám thính không có quái. Đang reset bí cảnh...";
                const realmData = await bicanh.joinSecretRealm(token, charId, config, "starter_01");
                currentRealmId = realmData?.realm_id || currentRealmId;
                scanCount = 0;
            }

            setTimeout(() => startCombatLoop(token, charId, config), currentMobId ? 0 : 5000);
            return;
        } catch (e) {
            bossMsg = "Lỗi kết nối snapshot. Thử lại sau 5s...";
            setTimeout(() => startCombatLoop(token, charId, config), 5000);
            return;
        }
    }

    // 2. Nếu đã có quái (currentMobId != null) hoặc vừa tìm được, tiến hành tấn công
    // Code tấn công sẽ tiếp tục ở dưới
    if (scanCount >= 5) {
        bossMsg = "Mục tiêu cũ quá xa. Đang reset vùng thám thính...";
        const realmData = await bicanh.joinSecretRealm(token, charId, config, "starter_01");
        currentRealmId = realmData?.realm_id || currentRealmId;
        currentMobId = null;
        scanCount = 0;
        setTimeout(() => startCombatLoop(token, charId, config), 1000);
        return;
    }
    try {
        const res = await bicanh.attackMob(token, charId, config, currentRealmId, currentMobId);
        let nextWait = 3200;

        if (res && res.ok) {
            scanCount = 0; // Reset đếm khi có mục tiêu chuẩn
            const critLabel = res.is_crit ? "[BẠO KÍCH!] " : "";
            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            bossMsg = `${critLabel}Gây: -${res.damage} HP ${hpLeft}\n > Nhân vật: HP: ${res.hp_after} | MP: ${res.mp_after}`;

            if (res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;

            if (res.mob_hp_after <= 0) {
                bossMsg = `[!] Đã tiêu diệt mục tiêu! Đang tìm con khác...`;
                currentMobId = null;
                nextWait = 1000;
            }
        } else {
            const errorMap = {
                'attack_cooldown': 'Đang hồi chiêu',
                'mob_dead': 'Mục tiêu đã tử trận',
                'target_out_of_range': 'Mục tiêu ngoài tầm đánh',
                'not_found': 'Không tìm thấy mục tiêu'
            };
            const errorReason = errorMap[res?.reason] || res?.reason || res?.message || "Lỗi kết nối";

            if (res?.reason === 'attack_cooldown') {
                const waitSec = res.remain_sec || 3;
                bossMsg = `[!] Đang hồi chiêu (Chờ ${waitSec}s)...`;
                nextWait = (waitSec * 1000) + 200;
                // Không xóa currentMobId để đánh tiếp con này sau khi hết cooldown
            } else {
                bossMsg = `[!] Thất bại: ${errorReason}.`;
                // Luôn xóa mục tiêu cũ khi thất bại (trừ khi cooldown)
                currentMobId = null;
                scanCount++;

                if (!res || errorReason.toLowerCase().includes("range") || errorReason.toLowerCase().includes("tầm") || errorReason.includes("not found")) {
                    nextWait = 500;
                } else {
                    nextWait = 2000;
                }
            }
        }

        setTimeout(() => startCombatLoop(token, charId, config), nextWait);

    } catch (e) {
        bossMsg = `Lỗi hệ thống: ${e.message}`;
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
        currentRealmId = realmData?.realm_id;

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

                const stats = await tracker.getCharacterStats(token, charId, config);

                const status = data.cultivation_status;
                const totalExp = status.cultivation_exp_progress + status.claimable_exp;
                
                const myHP = stats?.final?.hp || 0;
                const myMP = stats?.final?.mana || 0;

                console.clear();
                console.log(`===========================================================`);
                console.log(` Đạo hữu:    ${data.home.character.name}`);
                console.log(` Cảnh giới:  ${data.home.stats.base.realm_name}`);
                console.log(` HP:         ${myHP} | MP: ${myMP}`);
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
                    if (status.claimable_exp > 0) {
                        await tracker.claimExp(token, charId, config);
                    } else {
                        await tracker.doBreakthrough(token, charId, config);
                    }
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