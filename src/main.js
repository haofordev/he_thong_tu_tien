import { loginAndGetInfo, refreshTokenIfNeeded } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';

let auth = {
    token: null,
    charId: null,
    config: null,
    accountIndex: 0,
    expiresAt: 0
};


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

// const mapSequence = ["sect_lk_c01", "sect_lk_c02", "sect_lk_c03", "sect_lk_c04"];
const mapSequence = ["starter_01"];

let mapIndex = 0;
activeMapCode = mapSequence[0];
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
            const aliveMobs = snapshot?.mobs?.filter(m => m && m.status === 'alive' && m.hp > 0) || [];

            // Tìm mục tiêu: CHỈ Boss/Elite
            let target = bicanh.findOnlyBossElite(snapshot, charId);

            if (target) {
                currentMobId = target.id;
                currentMobKind = target.mobKind;
                scanCount = 0;
                const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? "[BOSS] " : "";
                const rangeLabel = target.inRange ? "" : ` [NGOÀI TẦM: ${Math.round(target.distance)}px]`;
                process.stdout.write(`\r[SĂN BOSS] ${activeMapCode} -> ${kindLabel}${currentMobId.substring(0, 8)}...${rangeLabel}          `);
            } else {
                scanCount++;
                bossMsg = `Map [${activeMapCode}] kô thấy boss... (Lần ${scanCount})`;
            }

            if (scanCount >= 1) { // Đổi ngay nếu không thấy Boss/Elite
                mapIndex = (mapIndex + 1) % mapSequence.length;
                activeMapCode = mapSequence[mapIndex];
                bossMsg = `Chuyển map -> ${activeMapCode}`;
                process.stdout.write(`\r[HỆ THỐNG] Đang chuyển sang ${activeMapCode}...                      `);
                const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
                currentRealmId = realmData?.realm_id || currentRealmId;
                scanCount = 0;
            }

            setTimeout(() => startCombatLoop(), currentMobId ? 0 : 3000);
            return;
        } catch (e) {
            setTimeout(() => startCombatLoop(), 5000);
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
            const kind = (currentMobKind === 'boss' || currentMobKind === 'elite') ? `[${currentMobKind.toUpperCase()}] ` : "";
            bossMsg = `${kind}${mode}${res.is_crit ? "[BẠO!] " : ""}Gây: -${res.damage ?? 0} HP ${hpLeft}`;

            process.stdout.write(`\r[TRẬN ĐÁNH] ${kind}Gây -${res.damage ?? 0} HP ${hpLeft}                `);

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
        setTimeout(() => startCombatLoop(), nextWait);
    } catch (e) {
        currentMobId = null;
        setTimeout(() => startCombatLoop(), 5000);
    }
}

async function manageOfflineAFK() {
    const { token, charId, config } = auth;

    try {
        const start = await tracker.startOfflineAFK(token, charId, config, activeMapCode);
        afkMsg = (start && start.ok) ? `Đang chạy (Hết hạn sau 4h)` : `Lỗi AFK`;
    } catch (e) { afkMsg = `Lỗi AFK`; }
}

async function manageChests() {
    const { token, charId, config } = auth;

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
        const accountIndex = parseInt(process.argv[2] || "0");
        const loginData = await loginAndGetInfo(accountIndex);
        Object.assign(auth, loginData, { accountIndex });

        const { token, charId, config, userData } = auth;

        activeMapCode = userData.map_code || mapSequence[0];
        const charName = userData.char_name || "Đạo hữu";

        // 1. CHẠY DASHBOARD
        setInterval(async () => {
            try {
                // Kiểm tra và refresh token nếu cần
                const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
                if (newAuth) {
                    Object.assign(auth, newAuth);
                    console.log(`\n[HỆ THỐNG] Đã làm mới token thành công.\n`);
                }

                const { token, charId, config } = auth;
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
                    console.log(` Đạo hữu:    ${data.home.character.name} (Tài khoản ${accountIndex})`);
                    console.log(` HP:         ${latestHP} | MP: ${latestMP}`);
                    console.log(` Thể lực:    ${latestStamina} | Thân hồn: ${latestSpirit}`);
                    console.log(` Linh thạch: ${spiritStones.toLocaleString()}`);
                    console.log(`-----------------------------------------------------------`);
                    console.log(` EXP: ${status.cultivation_exp_progress} / ${status.exp_to_next} (${(((status.cultivation_exp_progress + status.claimable_exp) / status.exp_to_next) * 100).toFixed(2)}%)`);
                    console.log(`-----------------------------------------------------------`);
                    console.log(` [CHIẾN ĐẤU BÍ CẢNH]: ${bossMsg}`);
                    console.log(` [KỲ NGỘ]: ${latestMsg}`);
                    console.log(` [OFFLINE AFK]: ${afkMsg}`);
                    console.log(` [WORLD BOSS]: ${wbMsg}`);
                    console.log(`-----------------------------------------------------------`);

                    if (latestHP < 1000 && inventoryCounts['pill_lk_hp'] > 0) await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_hp');

                    // Thể lực < 10 thì cắn thuốc thể lực
                    if (latestStamina < 30 && inventoryCounts['pill_lk_stamina'] > 0) {
                        await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_stamina');
                    }
                    // Thần hồn < 10 thì cắn thuốc thần hồn (Check >= 5 bình)
                    if (latestSpirit < 30 && (inventoryCounts['pill_lk_spirit'] || 0) >= 5) {
                        await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_spirit');
                    }

                    if (status.cultivation_exp_progress + status.claimable_exp >= status.exp_to_next) {
                        if (status.claimable_exp > 0) await tracker.claimExp(auth.token, auth.charId, auth.config);
                        else await tracker.doBreakthrough(auth.token, auth.charId, auth.config);
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

        startCombatLoop();

        setInterval(() => manageOfflineAFK(), 600000);
        manageOfflineAFK();

        setInterval(() => manageChests(), 60000);
        manageChests();

        setInterval(async () => {
            const { token, charId, config } = auth;
            const reasons = [];
            if (latestHP < 30) reasons.push("Sinh lực");
            if (latestStamina < 30) reasons.push("Thể lực");
            if (latestSpirit < 30) reasons.push("Thân hồn");

            if (reasons.length === 0) {
                await kyngo.triggerKiNgo(token, charId, config);
                setTimeout(async () => { latestMsg = await kyngo.getLatestLog(token, charId, config); }, 2000);
            } else {
                latestMsg = `[HỆ THỐNG] ${reasons.join("/")} thấp (<30), tạm dừng Kỳ Ngộ để hồi phục.`;
            }
        }, 31000);

    } catch (err) { console.error('[CRITICAL ERROR]', err.message); }
}

start();