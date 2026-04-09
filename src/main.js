import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';

let latestMsg = "Đang khởi tạo...";
let bossMsg = "Đang tìm mục tiêu...";
let afkMsg = "Chưa kiểm tra AFK";
let wbMsg = "Đang ở Bí Cảnh (Không săn Boss TG)";
let wbDmg = 0;
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
    if (!currentMobId) {
        try {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, currentRealmId);
            const aliveMobs = snapshot?.mobs?.filter(m => m && m.status === 'alive' && m.hp > 0) || [];
            
            // Tìm mục tiêu: Ưu tiên Boss/Elite trong tầm đánh
            let target = bicanh.findNewTarget(snapshot, charId);

            if (target) {
                currentMobId = target.id;
                currentMobKind = target.mobKind;
                scanCount = 0;
                const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? "[BOSS] " : "";
                const rangeLabel = target.inRange ? "" : ` [NGOÀI TẦM: ${Math.round(target.distance)}px]`;
                process.stdout.write(`\r[BÍ CẢNH] ${kindLabel}Nhắm: ${currentMobId.substring(0, 8)}...${rangeLabel}          `);
            } else {
                scanCount++;
                bossMsg = `Đang tìm mục tiêu... (Lần ${scanCount})`;
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

    try {
        // Chiến thuật MP: > 50 dùng chiêu, <= 50 đánh thường
        const useNormalAttack = (latestMP <= 50);
        const res = await bicanh.attackMob(token, charId, config, currentRealmId, currentMobId, useNormalAttack);
        
        let isBoss = (currentMobKind === 'boss' || currentMobKind === 'elite');
        let nextWait = isBoss ? 5000 : 3200;

        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            scanCount = 0;
            if (res.mp_after !== undefined) latestMP = res.mp_after;
            if (res.hp_after !== undefined) latestHP = res.hp_after;

            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            const mode = useNormalAttack ? "[THƯỜNG] " : "[CHIÊU] ";
            bossMsg = `${mode}${res.is_crit ? "[BẠO!] " : ""}Gây: -${res.damage ?? 0} HP ${hpLeft}`;

            if (!isBoss && res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;

            if (res.mob_hp_after <= 0) {
                currentMobId = null;
                currentMobKind = null;
                nextWait = 1000;
            }
        } else {
            if (res?.reason === 'attack_cooldown') {
                nextWait = (res.remain_sec * 1000) + 200;
            } else if (res?.reason === 'not_joined' || res?.reason === 'not_found' || res?.reason === 'target_out_of_range') {
                currentMobId = null;
                nextWait = 1000;
                scanCount++;
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
        const start = await tracker.startOfflineAFK(token, charId, config, activeMapCode);
        afkMsg = (start && start.ok) ? `Đang chạy (Hết hạn sau 4h)` : `Lỗi AFK`;
    } catch (e) { afkMsg = `Lỗi AFK`; }
}

async function manageChests(token, charId, config) {
    try {
        const inv = await tracker.listInventory(token, charId, config);
        const containers = inv.filter(item => item.item_type === 'container' && item.qty > 0);
        if (containers.length > 0) {
            latestMsg = `[HỆ THỐNG] Đang mở ${containers.length} loại rương...`;
            for (const item of containers) {
                await tracker.openContainer(token, charId, config, item.code, item.qty);
            }
            latestMsg = `[HỆ THỐNG] Đã mở rương xong.`;
        }
    } catch (e) { }
}

async function start() {
    try {
        const { token, charId, config, map_code } = await loginAndGetInfo();
        activeMapCode = map_code;

        // 1. CHẠY DASHBOARD
        setInterval(async () => {
            try {
                const data = await tracker.getStatus(token, charId, config);
                const inv = await tracker.listInventory(token, charId, config);
                
                if (data?.cultivation_status && data?.home) {
                    const status = data.cultivation_status;
                    const res = data.home.resources || {};
                    const wallet = data.home.wallet || {};
                    
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
                    console.log(` EXP: ${status.cultivation_exp_progress} / ${status.exp_to_next} (${(( (status.cultivation_exp_progress + status.claimable_exp) / status.exp_to_next) * 100).toFixed(2)}%)`);
                    console.log(`-----------------------------------------------------------`);
                    console.log(` [CHIẾN ĐẤU BÍ CẢNH]: ${bossMsg}`);
                    console.log(` [KỲ NGỘ]: ${latestMsg}`);
                    console.log(` [OFFLINE AFK]: ${afkMsg}`);
                    console.log(` [WORLD BOSS]: ${wbMsg}`);
                    console.log(`-----------------------------------------------------------`);

                    if (latestHP < 1000 && inventoryCounts['pill_lk_hp'] > 0) await tracker.useItem(token, charId, config, 'pill_lk_hp');
                    
                    if (status.cultivation_exp_progress + status.claimable_exp >= status.exp_to_next) {
                        if (status.claimable_exp > 0) await tracker.claimExp(token, charId, config);
                        else await tracker.doBreakthrough(token, charId, config);
                    }
                }
                console.log(` Cập nhật lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`===========================================================`);
            } catch (e) { }
        }, 3000);

        // 2. VÀO BÍ CẢNH NGAY LẬP TỨC
        const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
        currentRealmId = realmData?.realm_id;
        
        await kyngo.enterKiNgo(token, charId, config);
        latestMsg = await kyngo.getLatestLog(token, charId, config);

        startCombatLoop(token, charId, config);
        
        setInterval(() => manageOfflineAFK(token, charId, config), 600000);
        manageOfflineAFK(token, charId, config);
        
        setInterval(() => manageChests(token, charId, config), 60000);
        manageChests(token, charId, config);

        setInterval(async () => {
            if (latestStamina >= 30 && latestSpirit >= 30) {
                await kyngo.triggerKiNgo(token, charId, config);
                setTimeout(async () => { latestMsg = await kyngo.getLatestLog(token, charId, config); }, 2000);
            } else {
                latestMsg = `[HỆ THỐNG] Sinh lực thấp (<30), tạm dừng Kỳ Ngộ để hồi phục.`;
            }
        }, 31000);

    } catch (err) { console.error('[CRITICAL ERROR]', err.message); }
}

start();