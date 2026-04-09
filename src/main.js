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
let activeMapCode = "starter_01";
let currentMobId = null;
let currentMobKind = null;
let scanCount = 0; 
let latestHP = 0;
let latestMP = 0;
let latestStamina = 0;
let latestSpirit = 0;
let spiritStones = 0;
let inventoryCounts = {}; 

async function startCombatLoop(token, charId, config) {
    if (isHuntingWB) {
        setTimeout(() => startCombatLoop(token, charId, config), 5000);
        return;
    }

    if (!currentMobId) {
        try {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, currentRealmId);
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
                bossMsg = `Không tìm thấy bất kỳ quái nào. (Lần ${scanCount})`;
            }

            if (scanCount >= 5) {
                bossMsg = "Reset bí cảnh...";
                const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
                currentRealmId = realmData?.realm_id || currentRealmId;
                scanCount = 0;
            }

            setTimeout(() => startCombatLoop(token, charId, config), currentMobId ? 0 : 5000);
            return;
        } catch (e) {
            setTimeout(() => startCombatLoop(token, charId, config), 5000);
            return;
        }
    }

    if (scanCount >= 5) {
        const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
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

        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            scanCount = 0;
            if (res.hp_after !== undefined) latestHP = res.hp_after;
            if (res.mp_after !== undefined) latestMP = res.mp_after;

            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            bossMsg = `${res.is_crit ? "[BẠO!] " : ""}Gây: -${res.damage ?? 0} HP ${hpLeft}`;

            if (!isBoss && res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;

            if (res.mob_hp_after <= 0) {
                currentMobId = null;
                currentMobKind = null;
                nextWait = 1000;
            }
        } else {
            if (res?.reason === 'attack_cooldown') {
                nextWait = (res.remain_sec * 1000) + 200;
            } else if (res?.reason === 'not_enough_mana') {
                await tracker.useItem(token, charId, config, 'pill_lk_mp');
                nextWait = 1000;
            } else if (res?.reason === 'not_joined' || res?.reason === 'not_found' || res?.reason === 'target_out_of_range') {
                if (isBoss && res?.reason === 'target_out_of_range') {
                    nextWait = 5000;
                    scanCount++; // Đếm để reset nếu cứ đứng xa mãi
                } else if (res?.reason === 'target_out_of_range') {
                    bossMsg = `[!] Quái ngoài tầm. Đang tìm con khác...`;
                    currentMobId = null;
                    scanCount++;
                    nextWait = 1000;
                } else {
                    currentMobId = null;
                    nextWait = 1000;
                }
            } else {
                currentMobId = null;
                nextWait = 1000;
            }
        }
        setTimeout(() => startCombatLoop(token, charId, config), nextWait);
    } catch (e) {
        currentMobId = null;
        setTimeout(() => startCombatLoop(token, charId, config), 5000);
    }
}

async function manageOfflineAFK(token, charId, config) {
    try {
        afkMsg = "Đang kiểm tra AFK...";
        const status = await tracker.checkOfflineAFK(token, charId, config);
        if (status && status.active) await tracker.claimOfflineAFK(token, charId, config);
        const start = await tracker.startOfflineAFK(token, charId, config, activeMapCode);
        afkMsg = (start && start.ok) ? `Đang chạy (Hết hạn sau 4h)` : `Lỗi AFK`;
    } catch (e) { afkMsg = `Lỗi AFK: ${e.message}`; }
}

async function manageWorldBossTask(token, charId, config) {
    try {
        isHuntingWB = true;
        wbMsg = "Đang kiểm tra Boss...";
        const res = await manageWorldBoss(token, charId, config, (msg) => {
            wbMsg = msg;
        });
        wbDmg = res.myDmg || 0;
        wbRank = res.myRank || 'Chưa có';
        wbMsg = res.bossHp !== undefined ? `Máu Boss: ${res.bossHp.toLocaleString()} HP` : (res.msg || "Không có Boss");
        isHuntingWB = false;
    } catch (e) { isHuntingWB = false; }
}

async function manageChests(token, charId, config) {
    try {
        const chestItems = Object.keys(inventoryCounts).filter(code => 
            (code.startsWith('chest_') || code.includes('mob_chest')) && inventoryCounts[code] > 0
        );
        if (chestItems.length > 0) {
            latestMsg = `[HỆ THỐNG] Đang mở ${chestItems.length} loại rương...`;
            for (const code of chestItems) {
                await tracker.openContainer(token, charId, config, code, inventoryCounts[code]);
            }
            latestMsg = `[HỆ THỐNG] Đã mở rương xong.`;
        }
    } catch (e) { }
}

async function start() {
    try {
        const { token, charId, config, map_code } = await loginAndGetInfo();
        activeMapCode = map_code;
        const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
        currentRealmId = realmData?.realm_id;

        await kyngo.enterKiNgo(token, charId, config);
        latestMsg = await kyngo.getLatestLog(token, charId, config);

        startCombatLoop(token, charId, config);
        
        // Tác vụ định kỳ
        setInterval(() => manageOfflineAFK(token, charId, config), 600000);
        manageOfflineAFK(token, charId, config);
        
        setInterval(() => manageWorldBossTask(token, charId, config), 120000);
        manageWorldBossTask(token, charId, config);

        setInterval(() => manageChests(token, charId, config), 30000);
        manageChests(token, charId, config);

        setInterval(async () => {
            try {
                const data = await tracker.getStatus(token, charId, config);
                const inv = await tracker.listInventory(token, charId, config);
                
                if (data?.cultivation_status && data?.home) {
                    const status = data.cultivation_status;
                    const res = data.home.resources || {};
                    const wallet = data.home.wallet || {};
                    const totalExp = status.cultivation_exp_progress + status.claimable_exp;
                    
                    latestHP = res.hp || 0;
                    latestMP = res.mp || 0;
                    latestStamina = res.stamina || 0;
                    latestSpirit = res.spirit || 0;
                    spiritStones = wallet.spirit_stones || 0;
                    
                    inventoryCounts = {};
                    if (Array.isArray(inv)) inv.forEach(item => inventoryCounts[item.code] = item.qty);

                    console.clear();
                    console.log(`===========================================================`);
                    console.log(` Đạo hữu:    ${data.home.character.name}`);
                    console.log(` HP:         ${latestHP} | MP: ${latestMP}`);
                    console.log(` Thể lực:    ${latestStamina} | Thân hồn: ${latestSpirit}`);
                    console.log(` Linh thạch: ${spiritStones.toLocaleString()}`);
                    console.log(`-----------------------------------------------------------`);
                    console.log(` EXP: ${status.cultivation_exp_progress} / ${status.exp_to_next} (${((totalExp / status.exp_to_next) * 100).toFixed(2)}%)`);
                    console.log(`-----------------------------------------------------------`);
                    console.log(` [CHIẾN ĐẤU BÍ CẢNH]: ${isHuntingWB ? "[ĐANG ƯU TIÊN SĂN BOSS]" : bossMsg}`);
                    console.log(` [KỲ NGỘ]: ${latestMsg}`);
                    console.log(` [OFFLINE AFK]: ${afkMsg}`);
                    console.log(` [WORLD BOSS]: ${wbMsg} ${wbDmg > 0 ? `| Dmg: ${wbDmg.toLocaleString()}` : ""}`);
                    console.log(`-----------------------------------------------------------`);

                    if (latestHP < 1000 && (inventoryCounts['pill_lk_hp'] > 0)) {
                        await tracker.useItem(token, charId, config, 'pill_lk_hp');
                        inventoryCounts['pill_lk_hp']--;
                    }
                    if (latestMP < 20 && (inventoryCounts['pill_lk_mp'] > 0)) {
                        await tracker.useItem(token, charId, config, 'pill_lk_mp');
                        inventoryCounts['pill_lk_mp']--;
                    }
                    if (latestStamina < 20 && (inventoryCounts['pill_lk_sta'] > 0)) {
                        await tracker.useItem(token, charId, config, 'pill_lk_sta');
                        inventoryCounts['pill_lk_sta']--;
                    }
                    if (latestSpirit < 20 && (inventoryCounts['pill_lk_spirit'] > 0)) {
                        await tracker.useItem(token, charId, config, 'pill_lk_spirit');
                        inventoryCounts['pill_lk_spirit']--;
                    }

                    if (totalExp >= status.exp_to_next) {
                        if (status.claimable_exp > 0) await tracker.claimExp(token, charId, config);
                        else await tracker.doBreakthrough(token, charId, config);
                    }
                }
                console.log(` Cập nhật lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`===========================================================`);
            } catch (e) { }
        }, 3000);

        setInterval(async () => {
            await kyngo.triggerKiNgo(token, charId, config);
            setTimeout(async () => { latestMsg = await kyngo.getLatestLog(token, charId, config); }, 2000);
        }, 31000);
    } catch (err) { console.error('[CRITICAL ERROR]', err.message); }
}

start();