import { loginAndGetInfo, refreshTokenIfNeeded } from './src/login.js';
import * as tracker from './src/track.js';
import * as kyngo from './src/ky_ngo.js';
import * as bicanh from './src/secret_realm.js';
import * as farm from './src/farm.js';

let auth = {
    token: null,
    charId: null,
    config: null,
    accountIndex: 0,
    expiresAt: 0
};

let latestMsg = "Đang khởi tạo...";
let bossMsg = "Đang tìm mục tiêu...";
let currentRealmId = null;
let activeMapCode = "starter_01";
let currentMobId = null;
let currentMobKind = null;
let currentMobInRange = true;
let currentMobRetryCount = 0;
let blockedMobId = null;
let scanCount = 0;

let mapSequence = [];
let mapIndex = 0;

let latestHP = 0;
let latestMP = 0;
let latestStamina = 0;
let latestSpirit = 0;
let spiritStones = 0;
let inventoryCounts = {};

async function startCombatLoop() {
    const { token, charId, config } = auth;

    if (!currentMobId) {
        try {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, currentRealmId);
            let target = bicanh.findNewTarget(snapshot, charId, blockedMobId);

            if (target) {
                blockedMobId = null;
                currentMobId = target.id;
                currentMobKind = target.mobKind;
                currentMobInRange = target.inRange;
                currentMobRetryCount = 0;
                if (target.inRange) scanCount = 0;

                const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? "[BOSS] " : "";
                process.stdout.write(`\r[SĂN BOSS] ${activeMapCode} -> ${kindLabel}${currentMobId.substring(0, 8)}... `);
            } else {
                scanCount++;
                bossMsg = `Map [${activeMapCode}] kô thấy boss... (Lần ${scanCount})`;
            }

            if (scanCount >= 5) {
                mapIndex = (mapIndex + 1) % mapSequence.length;
                activeMapCode = mapSequence[mapIndex];
                bossMsg = `Chuyển map -> ${activeMapCode}`;
                blockedMobId = null;
                const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
                currentRealmId = realmData?.realm_id || currentRealmId;
                scanCount = 0;
            }

            setTimeout(() => startCombatLoop(), currentMobId ? 0 : 1500);
            return;
        } catch (e) {
            setTimeout(() => startCombatLoop(), 5000);
            return;
        }
    }

    try {
        const useNormalAttack = (latestMP <= 50);
        const res = await bicanh.attackMob(token, charId, config, currentRealmId, currentMobId, useNormalAttack);

        let isBoss = (currentMobKind === 'boss' || currentMobKind === 'elite');
        let nextWait = !currentMobInRange ? 1500 : (isBoss ? 3500 : 2200);

        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            scanCount = 0;
            if (res.mp_after !== undefined) latestMP = res.mp_after;
            if (res.hp_after !== undefined) latestHP = res.hp_after;

            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            const kind = (currentMobKind === 'boss' || currentMobKind === 'elite') ? `[${currentMobKind.toUpperCase()}] ` : "";
            bossMsg = `${kind}${useNormalAttack ? "[THƯỜNG]" : "[CHIÊU]"} Gây: -${res.damage ?? 0} HP ${hpLeft}`;

            if (res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;

            if (res.mob_hp_after <= 0) {
                currentMobId = null;
                currentMobKind = null;
                currentMobInRange = true;
                currentMobRetryCount = 0;
                nextWait = 1000;
            }
        } else {
            if (res?.reason === 'attack_cooldown') {
                nextWait = (res.remain_sec * 1000) + 200;
            } else if (res?.reason === 'target_out_of_range') {
                currentMobInRange = false;
                currentMobRetryCount++;
                scanCount++;
                nextWait = 1500;
                if (currentMobRetryCount >= 3 || scanCount >= 5) {
                    blockedMobId = currentMobId;
                    currentMobId = null;
                    currentMobInRange = true;
                    currentMobRetryCount = 0;
                }
            }
        }
        setTimeout(() => startCombatLoop(), nextWait);
    } catch (e) {
        setTimeout(() => startCombatLoop(), 2000);
    }
}

async function start() {
    try {
        const accountIndex = parseInt(process.argv[2] || "0");
        const loginData = await loginAndGetInfo(accountIndex);
        Object.assign(auth, loginData, { accountIndex });

        if (Array.isArray(auth.userData.map_sequence)) {
            mapSequence = auth.userData.map_sequence;
        } else if (typeof auth.userData.map_sequence === 'string') {
            mapSequence = auth.userData.map_sequence.split(',').map(m => m.trim()).filter(m => m !== "");
        } else {
            mapSequence = ["train_lk_01", "sect_lk_c01"];
        }

        activeMapCode = auth.userData.map_code || mapSequence[0];
        mapIndex = mapSequence.indexOf(activeMapCode);
        if (mapIndex === -1) mapIndex = 0;

        // Dashboard loop
        setInterval(async () => {
            try {
                const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
                if (newAuth) Object.assign(auth, newAuth);

                const { token, charId, config } = auth;
                const data = await tracker.getStatus(token, charId, config);
                const inv = await tracker.listInventory(token, charId, config);

                if (data?.cultivation_status && data?.home) {
                    const status = data.cultivation_status;
                    const res = data.home.resources || {};
                    const wallet = data.home.wallet || {};

                    latestHP = res.hp || 0; latestMP = res.mp || 0;
                    latestStamina = res.stamina || 0; latestSpirit = res.spirit || 0;
                    spiritStones = wallet.spirit_stones || 0;

                    inventoryCounts = {};
                    if (Array.isArray(inv)) inv.forEach(item => inventoryCounts[item.code] = item.qty);

                    console.clear();
                    console.log(`================ TATUTIEN LITE ================`);
                    console.log(` Đạo hữu:    ${data.home.character.name}`);
                    console.log(` HP: ${latestHP} | MP: ${latestMP} | Linh thạch: ${spiritStones.toLocaleString()}`);
                    console.log(` EXP: ${status.cultivation_exp_progress} / ${status.exp_to_next} (${((status.cultivation_exp_progress / status.exp_to_next) * 100).toFixed(2)}%)`);
                    console.log(` ----------------------------------------------`);
                    console.log(` [BÍ CẢNH]: ${bossMsg}`);
                    console.log(` [HỆ THỐNG]: ${latestMsg}`);
                    console.log(`================================================`);

                    // Tự động hồi phục
                    const autoPill = auth.userData.auto_pill || { hp: 1000, hp_min: 0, mp: 50, mp_min: 0, sta: 20, sta_min: 0, spirit: 20, spirit_min: 0 };
                    
                    if (latestHP < autoPill.hp && inventoryCounts['pill_lk_hp'] > (autoPill.hp_min || 0)) await tracker.useItem(token, charId, config, 'pill_lk_hp');
                    if (latestMP < autoPill.mp && inventoryCounts['pill_lk_mp'] > (autoPill.mp_min || 0)) await tracker.useItem(token, charId, config, 'pill_lk_mp');
                    if (latestStamina < autoPill.sta && inventoryCounts['pill_lk_sta'] > (autoPill.sta_min || 0)) await tracker.useItem(token, charId, config, 'pill_lk_sta');
                    if (latestSpirit < autoPill.spirit && inventoryCounts['pill_lk_spirit'] > (autoPill.spirit_min || 0)) await tracker.useItem(token, charId, config, 'pill_lk_spirit');

                    // Auto EXP & Breakthrough
                    if (status.cultivation_exp_progress + status.claimable_exp >= status.exp_to_next) {
                        if (status.claimable_exp > 0) await tracker.claimExp(token, charId, config);
                        else await tracker.doBreakthrough(token, charId, config);
                    }
                }
            } catch (e) { }
        }, 3000);

        // Join realm
        const realmData = await bicanh.joinSecretRealm(auth.token, auth.charId, auth.config, activeMapCode);
        currentRealmId = realmData?.realm_id;

        await kyngo.enterKiNgo(auth.token, auth.charId, auth.config);
        latestMsg = await kyngo.getLatestLog(auth.token, auth.charId, auth.config);

        // Auto Harvest
        setInterval(async () => {
            try {
                await farm.harvestAndPlant(auth.token, auth.charId, auth.config);
                latestMsg = "Đã kiểm tra và thu hoạch Linh Điền";
            } catch (e) { }
        }, 120000);

        // Auto Kỳ Ngộ
        setInterval(async () => {
            try {
                if (latestHP > 30 && latestStamina > 30 && latestSpirit > 30) {
                    await kyngo.triggerKiNgo(auth.token, auth.charId, auth.config);
                    setTimeout(async () => {
                        latestMsg = await kyngo.getLatestLog(auth.token, auth.charId, auth.config);
                    }, 2000);
                }
            } catch (e) { }
        }, 31000);

        
        startCombatLoop();

    } catch (err) { console.error('[LỖI]', err.message); }
}

start();
