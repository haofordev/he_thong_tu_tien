import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';
import { manageWorldBoss } from './world_boss.js';

let latestMsg = "Đang khởi tạo...";
let bossMsg = "Đang tìm mục tiêu...";
let afkMsg = "Chưa kiểm tra AFK";
let wbMsg = "Chưa kiểm tra WB";
let wbDmg = 0;
let wbRank = 'Chưa có';
let isHuntingWB = false;
let currentRealmId = null;
let currentMobId = null;
let currentMobKind = null;
let scanCount = 0; // Đếm số lần quét hụt
let latestHP = 0;
let latestMP = 0;
let latestStamina = 0;
let latestSpirit = 0;
let inventoryCounts = {}; // Lưu số lượng vật phẩm quan trọng

async function startCombatLoop(token, charId, config) {
    if (isHuntingWB) {
        setTimeout(() => startCombatLoop(token, charId, config), 5000);
        return;
    }

    // 1. Nếu không có mục tiêu, thám thính
    if (!currentMobId) {
        try {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, currentRealmId);

            // Tìm Boss trước, bất kể tầm đánh
            const aliveMobs = snapshot?.mobs?.filter(m => m && m.status === 'alive' && m.hp > 0) || [];
            const boss = aliveMobs.find(m => m.mob_kind === 'boss' || m.mob_kind === 'elite');

            let target = null;
            if (boss) {
                const me = snapshot.participants?.find(p => p.character_id === charId) || snapshot.top_players?.find(p => p.character_id === charId);
                const myX = me ? me.x : (snapshot.realm?.spawn_x_px || 1000);
                const myY = me ? me.y : (snapshot.realm?.spawn_y_px || 1000);
                const range = snapshot.realm?.skill_range_px || 300;
                const distance = Math.sqrt(Math.pow(myX - boss.x, 2) + Math.pow(myY - boss.y, 2));
                target = { id: boss.id, inRange: distance <= range, distance, mobKind: boss.mob_kind };
            } else {
                target = bicanh.findNewTarget(snapshot, charId);
            }

            if (target) {
                currentMobId = target.id;
                currentMobKind = target.mobKind;
                scanCount = 0;
                const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? "[BOSS] " : "";
                const rangeLabel = target.inRange ? "" : ` [NGOÀI TẦM: ${Math.round(target.distance)}px]`;
                process.stdout.write(`\r[BÍ CẢNH] ${kindLabel}Nhắm: ${currentMobId.substring(0, 8)}...${rangeLabel}          `);
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
        let isBoss = (currentMobKind === 'boss' || currentMobKind === 'elite');
        let nextWait = isBoss ? 5000 : 3200;

        // Kiểm tra httpOk (kết nối) và res.ok (game logic)
        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            scanCount = 0; // Reset đếm khi có mục tiêu chuẩn
            const critLabel = res.is_crit ? "[BẠO KÍCH!] " : "";
            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";

            // Cập nhật HP/MP từ response
            if (res.hp_after !== undefined) latestHP = res.hp_after;
            if (res.mp_after !== undefined) latestMP = res.mp_after;

            bossMsg = `${critLabel}Gây: -${res.damage ?? 0} HP ${hpLeft}\n > Nhân vật: HP: ${latestHP} | MP: ${latestMP}`;

            if (!isBoss && res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;

            if (res.mob_hp_after <= 0) {
                bossMsg = `[!] Đã tiêu diệt mục tiêu! Đang tìm con khác...`;
                currentMobId = null;
                currentMobKind = null;
                nextWait = 1000;
            }

            // Tự động hồi phục sau khi đánh (Dùng stats mới nhất)
            if (latestHP < 10) {
                if ((inventoryCounts['pill_lk_hp'] || 0) > 0) {
                    process.stdout.write("\n[HỆ THỐNG] HP thấp! Đang sử dụng pill_lk_hp...");
                    await tracker.useItem(token, charId, config, 'pill_lk_hp');
                    inventoryCounts['pill_lk_hp']--; // Giảm tạm thời
                } else {
                    process.stdout.write("\n[CẢNH BÁO] Hết pill_lk_hp!");
                }
            }
            if (latestMP < 10) {
                if ((inventoryCounts['pill_lk_mp'] || 0) > 0) {
                    process.stdout.write("\n[HỆ THỐNG] MP thấp! Đang sử dụng pill_lk_mp...");
                    await tracker.useItem(token, charId, config, 'pill_lk_mp');
                    inventoryCounts['pill_lk_mp']--;
                } else {
                    process.stdout.write("\n[CẢNH BÁO] Hết pill_lk_mp!");
                }
            }
        } else {
            const errorMap = {
                'attack_cooldown': 'Đang hồi chiêu',
                'mob_dead': 'Mục tiêu đã tử trận',
                'target_out_of_range': 'Mục tiêu ngoài tầm đánh',
                'not_found': 'Không tìm thấy mục tiêu',
                'not_enough_mana': 'Không đủ Mana',
                'not_joined': 'Chưa vào Bí cảnh'
            };
            const errorReason = errorMap[res?.reason] || res?.reason || res?.message || "Lỗi kết nối";

            if (res?.reason === 'attack_cooldown') {
                const waitSec = res.remain_sec || 3;
                bossMsg = `[!] Đang hồi chiêu (Chờ ${waitSec}s)...`;
                nextWait = (waitSec * 1000) + 200;
            } else if (res?.reason === 'not_enough_mana' || res?.mana_cost !== undefined) {
                if ((inventoryCounts['pill_lk_mp'] || 0) > 0) {
                    bossMsg = `[!] Cần ${res.mana_cost || 'thêm'} Mana. Đang cắn thuốc...`;
                    await tracker.useItem(token, charId, config, 'pill_lk_mp');
                    inventoryCounts['pill_lk_mp']--;
                } else {
                    bossMsg = `[!] Hết Mana và không còn thuốc hồi MP!`;
                }
                nextWait = 1000;
            } else if (res?.reason === 'not_joined' || res?.reason === 'not_found') {
                bossMsg = `[!] Lỗi: ${errorReason}. Đang tiến hành tham gia lại...`;
                const realmData = await bicanh.joinSecretRealm(token, charId, config, "starter_01");
                currentRealmId = realmData?.realm_id || currentRealmId;
                currentMobId = null;
                currentMobKind = null;
                nextWait = 2000;
            } else {
                bossMsg = `[!] Thất bại: ${errorReason}.`;

                if (isBoss && (errorReason.toLowerCase().includes("range") || errorReason.toLowerCase().includes("tầm"))) {
                    // Nếu là boss mà ngoài tầm, vẫn giữ mục tiêu nhưng chờ 5s rồi thử lại
                    nextWait = 5000;
                    bossMsg += " Đang chờ boss vào tầm (5s)...";
                } else {
                    currentMobId = null;
                    currentMobKind = null;
                    scanCount++;
                    nextWait = 1000;
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

async function manageOfflineAFK(token, charId, config) {
    try {
        afkMsg = "Đang kiểm tra AFK...";
        const status = await tracker.checkOfflineAFK(token, charId, config);
        
        if (status && status.active) {
            afkMsg = `Đang nhận EXP Offline...`;
            await tracker.claimOfflineAFK(token, charId, config);
        }

        afkMsg = "Đang kích hoạt Offline AFK mới...";
        const start = await tracker.startOfflineAFK(token, charId, config, "starter_01");
        
        if (start && start.ok) {
            afkMsg = `Đang chạy (Hết hạn sau 4h)`;
        } else {
            afkMsg = `Lỗi: ${start?.message || 'Không thể bắt đầu'}`;
        }
    } catch (e) {
        afkMsg = `Lỗi AFK: ${e.message}`;
    }
}

// Chú ý: Nhớ gọi startCombatLoop(token, charId, config) trong hàm start()

async function manageWorldBossTask(token, charId, config) {
    try {
        isHuntingWB = true;
        wbMsg = "Đang kiểm tra Boss...";
        const res = await manageWorldBoss(token, charId, config);
        wbDmg = res.myDmg || 0;
        wbRank = res.myRank || 'Chưa có';
        
        if (res.bossHp !== undefined) {
            wbMsg = `Máu Boss: ${res.bossHp}`;
        } else {
            wbMsg = res.msg || (res.foundBoss ? "Đã săn được Boss!" : "Hiện tại không có Boss.");
        }
        isHuntingWB = false;
    } catch (e) {
        wbMsg = `Lỗi: ${e.message}`;
        isHuntingWB = false;
    }
}

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

        // Quản lý Offline AFK (Lần đầu và mỗi 10 phút)
        await manageOfflineAFK(token, charId, config);
        setInterval(async () => {
            await manageOfflineAFK(token, charId, config);
        }, 600000); 

        // Quản lý World Boss (Lần đầu và mỗi 15 phút)
        manageWorldBossTask(token, charId, config);
        setInterval(async () => {
            manageWorldBossTask(token, charId, config);
        }, 900000); 

        // Vòng lặp Dashboard (3s)
        setInterval(async () => {
            try {
                const data = await tracker.getStatus(token, charId, config);
                if (!data || !data.cultivation_status) return;

                const stats = await tracker.getCharacterStats(token, charId, config);

                const status = data.cultivation_status;
                const totalExp = status.cultivation_exp_progress + status.claimable_exp;

                // Đồng bộ HP/MP/Inventory từ Stats API & Inventory API
                latestHP = stats?.final?.hp || 0;
                latestMP = stats?.final?.mana || 0;
                latestStamina = stats?.final?.stamina || 0;
                latestSpirit = stats?.final?.spirit || 0;

                const inv = await tracker.listInventory(token, charId, config);
                if (Array.isArray(inv)) {
                    inventoryCounts = {};
                    inv.forEach(item => {
                        inventoryCounts[item.code] = item.qty;
                    });
                }

                console.clear();
                console.log(`===========================================================`);
                console.log(` Đạo hữu:    ${data.home.character.name}`);
                console.log(` Cảnh giới:  ${data.home.stats.base.realm_name}`);
                console.log(` HP:         ${latestHP} | MP: ${latestMP}`);
                console.log(` Thể lực:    ${latestStamina} | Thân hồn: ${latestSpirit}`);
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
                console.log(` [TRẠNG THÁI OFFLINE AFK]:`);
                console.log(` > ${afkMsg}`);
                console.log(`-----------------------------------------------------------`);
                console.log(` [WORLD BOSS]:`);
                console.log(` > ${wbMsg}`);
                if (wbDmg > 0) console.log(` > Sát thương: ${wbDmg} | Hạng: ${wbRank}`);
                console.log(`-----------------------------------------------------------`);

                // Kiểm tra Thể lực và Thân hồn
                if (latestStamina < 5) {
                    if ((inventoryCounts['pill_lk_sta'] || 0) > 0) {
                        process.stdout.write("\n[HỆ THỐNG] Thể lực thấp! Đang sử dụng pill_lk_sta...");
                        await tracker.useItem(token, charId, config, 'pill_lk_sta');
                        inventoryCounts['pill_lk_sta']--;
                    } else {
                        process.stdout.write("\n[CẢNH BÁO] Hết pill_lk_sta!");
                    }
                }
                if (latestSpirit < 5) {
                    if ((inventoryCounts['pill_lk_spirit'] || 0) > 0) {
                        process.stdout.write("\n[HỆ THỐNG] Thân hồn thấp! Đang sử dụng pill_lk_spirit...");
                        await tracker.useItem(token, charId, config, 'pill_lk_spirit');
                        inventoryCounts['pill_lk_spirit']--;
                    } else {
                        process.stdout.write("\n[CẢNH BÁO] Hết pill_lk_spirit!");
                    }
                }

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
        }, 31000);

    } catch (err) {
        console.error('[CRITICAL ERROR]', err.message);
    }
}

start();