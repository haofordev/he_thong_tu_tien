import { loginAndGetInfo, refreshTokenIfNeeded } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';
import * as farm from './farm.js';

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
let bodyPriority = "balanced"; // "balanced", "power" (fire), "survival" (wood)
let currentMobId = null;
let currentMobKind = null;
let currentMobInRange = true; // Lưu trạng thái target
let currentMobRetryCount = 0; // Số lần thử lại target quá xa
let blockedMobId = null; // Chặn target quá xa đã thử 3 lần
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

            let target = bicanh.findNewTarget(snapshot, charId, blockedMobId)

            if (target) {
                blockedMobId = null;
                currentMobId = target.id;
                currentMobKind = target.mobKind;
                currentMobInRange = target.inRange; // Lưu status
                currentMobRetryCount = 0;

                // Nếu thấy quái trong tầm thì reset, ngoài tầm thì giữ nguyên để đếm dồn
                if (target.inRange) scanCount = 0;

                const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? "[BOSS] " : "";
                const rangeLabel = target.inRange ? "" : ` [NGOÀI TẦM: ${Math.round(target.distance)}px]`;
                process.stdout.write(`\r[SĂN BOSS] ${activeMapCode} -> ${kindLabel}${currentMobId.substring(0, 8)}...${rangeLabel}          `);
            } else {
                scanCount++;
                bossMsg = `Map [${activeMapCode}] kô thấy boss... (Lần ${scanCount})`;
            }

            if (scanCount >= 5) { // Chuyển map sau 5 lần không tìm thấy target
                mapIndex = (mapIndex + 1) % mapSequence.length;
                activeMapCode = mapSequence[mapIndex];
                bossMsg = `Chuyển map -> ${activeMapCode}`;
                blockedMobId = null;
                process.stdout.write(`\r[HỆ THỐNG] Đang chuyển sang ${activeMapCode}...                      `);
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
        // Chiến thuật MP: > 50 dùng chiêu, <= 50 đánh thường
        const useNormalAttack = (latestMP <= 50);
        const res = await bicanh.attackMob(token, charId, config, currentRealmId, currentMobId, useNormalAttack);

        let isBoss = (currentMobKind === 'boss' || currentMobKind === 'elite');
        // Nếu target ngoài tầm, chờ ít hơn để nhân vật kịp di chuyển và thử lại
        let nextWait = !currentMobInRange ? 1500 : (isBoss ? 3500 : 2200);

        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            scanCount = 0;
            if (res.mp_after !== undefined) latestMP = res.mp_after;
            if (res.hp_after !== undefined) latestHP = res.hp_after;

            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            const speedInfo = res.atk_speed_sec ? ` | Spd: ${res.atk_speed_sec}s` : "";
            const mode = useNormalAttack ? "[THƯỜNG] " : "[CHIÊU] ";
            const kind = (currentMobKind === 'boss' || currentMobKind === 'elite') ? `[${currentMobKind.toUpperCase()}] ` : "";
            bossMsg = `${kind}${mode}${res.is_crit ? "[BẠO!] " : ""}Gây: -${res.damage ?? 0} HP ${hpLeft}${speedInfo}`;

            process.stdout.write(`\r[TRẬN ĐÁNH] ${kind}Gây -${res.damage ?? 0} HP ${hpLeft}                `);

            if (res.atk_speed_sec) nextWait = (res.atk_speed_sec * 1000) + 200;
            else if (!isBoss) nextWait = 2200;

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
            } else if (res?.reason === 'target_out_of_range' || res?.message === 'target_out_of_range') {
                // Target quá xa: giữ target và thử lại vài lần để game di chuyển
                currentMobInRange = false;
                currentMobRetryCount++;
                scanCount++; // Đếm cả lần thử lại này vào tổng số lần ngoài tầm liên tiếp
                nextWait = 1500;
                bossMsg = `Quái ngoài tầm... (Lần ${currentMobRetryCount}, Tổng: ${scanCount}/5)`;
                if (currentMobRetryCount >= 3 || scanCount >= 5) {
                    blockedMobId = currentMobId;
                    currentMobId = null;
                    currentMobKind = null;
                    currentMobInRange = true;
                    currentMobRetryCount = 0;
                }
            } else if (res?.reason === 'not_joined' || res?.reason === 'not_found') {
                currentMobId = null;
                currentMobKind = null;
                currentMobInRange = true;
                currentMobRetryCount = 0;
                nextWait = 1000;
                scanCount++;
            } else {
                // Lỗi khác
                currentMobId = null;
                currentMobKind = null;
                currentMobInRange = true;
                currentMobRetryCount = 0;
                nextWait = 1000;
                scanCount++;
            }
        }
        setTimeout(() => startCombatLoop(), nextWait);
    } catch (e) {
        currentMobId = null;
        currentMobInRange = true;
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

async function manageGarden() {
    const { token, charId, config } = auth;
    try {
        const res = await tracker.listFarmPlots(token, charId, config);
        if (!res || !res.plots) return;

        const now = new Date();
        for (const plot of res.plots) {
            // 1. Thu hoạch nếu chín
            if (plot.seed_code && plot.ready_at) {
                const ready = new Date(plot.ready_at);
                if (now >= ready) {
                    const harvest = await tracker.harvestCrop(token, charId, config, plot.slot);
                    if (harvest && harvest.ok) {
                        latestMsg = `[HỆ THỐNG] Đã thu hoạch ${plot.seed_name} tại ô ${plot.slot}`;
                    }
                }
            }

            // 2. Gieo hạt nếu trống
            if (!plot.seed_code) {
                // Lấy hạt giống trong kho
                const inv = Object.keys(inventoryCounts).filter(code => code.startsWith('seed_') && inventoryCounts[code] > 0);
                if (inv.length > 0) {
                    const seed = inv[0]; // Lấy hạt đầu tiên tìm thấy
                    const plant = await tracker.plantCrop(token, charId, config, plot.slot, seed);
                    if (plant && plant.ok) {
                        inventoryCounts[seed]--;
                        latestMsg = `[HỆ THỐNG] Đã gieo ${seed} vào ô ${plot.slot}`;
                    }
                }
            }
        }
    } catch (e) { }
}

async function manageBodyCult() {
    const { token, charId, config } = auth;
    try {
        const body = await tracker.getBodyCultivation(token, charId, config);
        if (!body) return;

        // 1. Kiểm tra xem có phiên nào xong chưa để nhận
        if (body.training_session && body.training_session.status === 'active') {
            const now = new Date();
            const end = new Date(body.training_session.end_at);
            if (now >= end) {
                const claimRes = await tracker.claimBodyTraining(token, charId, config);
                if (claimRes && claimRes.ok) {
                    latestMsg = `[HỆ THỐNG] Đã nhận phần thưởng Luyện Thể hệ ${body.training_session.element.toUpperCase()}`;
                }
            }
        }

        // 2. Nếu không có phiên nào đang chạy, bắt đầu phiên mới
        const elements = ['fire', 'wood', 'water', 'earth', 'metal'];
        if (!body.training_session || (body.training_session.status !== 'active')) {
            let targetEl = 'fire';

            if (bodyPriority === 'power') {
                targetEl = 'fire';
            } else if (bodyPriority === 'survival') {
                targetEl = 'wood';
            } else {
                // Balanced: Tìm hệ có cấp thấp nhất
                let lowestLv = 999;
                for (const el of elements) {
                    const lv = body[`${el}_level`] || 0;
                    if (lv < lowestLv) {
                        lowestLv = lv;
                        targetEl = el;
                    }
                }
            }

            const startRes = await tracker.startBodyTraining(token, charId, config, targetEl, "long");
            if (startRes && startRes.ok) {
                latestMsg = `[HỆ THỐNG] Bắt đầu Luyện Thể hệ ${targetEl.toUpperCase()} (8 giờ) - Chế độ: ${bodyPriority}`;
            }
        }

        // 3. Tự động nâng cấp nếu đủ nguyên liệu
        for (const el of elements) {
            const cost = body.next_upgrade_cost[el];
            const stoneKey = el === 'fire' ? 'hoa_linh_thach' :
                el === 'wood' ? 'moc_linh_thach' :
                    el === 'water' ? 'thuy_linh_thach' :
                        el === 'earth' ? 'tho_linh_thach' : 'kim_linh_thach';

            const hasStones = body.stones[stoneKey] || 0;
            const hasSS = body.spirit_stones || 0;

            if (hasStones >= cost.stone_cost && hasSS >= cost.ss_cost) {
                const upRes = await tracker.upgradeBodyElement(token, charId, config, el);
                if (upRes && upRes.ok) {
                    latestMsg = `[HỆ THỐNG] Nâng cấp Thể Tu hệ ${el.toUpperCase()} thành công!`;
                    break; // Mỗi lần chỉ nâng 1 phát để tránh lỗi race condition
                }
            }
        }

    } catch (e) { }
}

async function manageChests() {
    const { token, charId, config } = auth;

    try {
        const res = await tracker.openAllContainers(token, charId, config);
        if (res && (res.ok || res.message)) {
            const msg = res.message || "Thành công";
            latestMsg = `[HỆ THỐNG] Mở rương: ${msg}`;
        }
    } catch (e) { }
}

process.on('unhandledRejection', (reason, promise) => {
    // console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', (err) => {
    // console.error('[Uncaught Exception]', err);
});

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
            // Fallback nếu không có trong data.json
            mapSequence = ["train_lk_01", "sect_lk_c01"];
        }

        activeMapCode = auth.userData.map_code || mapSequence[0];
        mapIndex = mapSequence.indexOf(activeMapCode);
        if (mapIndex === -1) mapIndex = 0;

        const charName = auth.userData.char_name || "Đạo hữu";

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
                    console.log(` Đạo hữu:    ${data.home.character.name} (Tài khoản ${auth.accountIndex})`);
                    console.log(` HP:         ${latestHP} | MP: ${latestMP} (Dược: HP:${inventoryCounts['pill_lk_hp'] || 0} - MP:${inventoryCounts['pill_lk_mp'] || 0})`);
                    console.log(` Thể lực:    ${latestStamina} | Thân hồn: ${latestSpirit} (Dược: TL:${inventoryCounts['pill_lk_sta'] || 0} - TH:${inventoryCounts['pill_lk_spirit'] || 0})`);
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

                    // Thể lực < 30 thì cắn thuốc thể lực
                    if (latestStamina < 30 && inventoryCounts['pill_lk_sta'] > 0) {
                        await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_sta');
                    }
                    // Thần hồn < 30 thì cắn thuốc thần hồn (Check >= 1 bình)
                    if (latestSpirit < 30 && (inventoryCounts['pill_lk_spirit'] || 0) >= 5) {
                        await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_spirit');
                    }
                    // MP < 150 thì cắn thuốc MP nếu có
                    if (latestMP < 50 && (inventoryCounts['pill_lk_mp'] || 0) >= 1) {
                        await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_mp');
                    }

                    if (status.cultivation_exp_progress + status.claimable_exp >= status.exp_to_next) {
                        if (status.claimable_exp > 0) await tracker.claimExp(auth.token, auth.charId, auth.config);
                        else await tracker.doBreakthrough(auth.token, auth.charId, auth.config);
                    }

                    // Tự động nâng cấp Linh Mạch nếu còn ở cấp 0 và đủ linh thạch (>500)
                    if (data.home.linh_mach && data.home.linh_mach.level === 0 && spiritStones > 500) {
                        const upRes = await tracker.upgradeLinhMach(auth.token, auth.charId, auth.config);
                        if (upRes && upRes.ok) {
                            latestMsg = `[HỆ THỐNG] Đã tự động nâng cấp Linh Mạch (Lvl 0 -> 1)`;
                        }
                    }

                    // Tự động chuyển chỗ tu luyện nếu có chỗ tốt hơn (Ancient Cave +50%)
                    const spots = data.cultivation_spots?.spots || [];
                    const bestAvailable = spots.find(s => s.code === 'ancient_cave' && s.occupants < (s.capacity || 10));
                    const currentSpotCode = data.cultivation_status?.spot_code || data.qi_breakdown?.environment?.spot?.code;

                    if (bestAvailable && currentSpotCode !== 'ancient_cave') {
                        const moveRes = await tracker.changeCultivationSpot(auth.token, auth.charId, auth.config, 'ancient_cave');
                        if (moveRes && moveRes.ok) {
                            latestMsg = `[HỆ THỐNG] Đã tự động chuyển sang Ancient Cave (+50% EXP)`;
                        }
                    } else if (!bestAvailable && currentSpotCode === 'quiet_courtyard') {
                        // Nếu cave full, thử spirit vein (+20%)
                        const vein = spots.find(s => s.code === 'spirit_vein' && s.occupants < (s.capacity || 50));
                        if (vein) {
                            await tracker.changeCultivationSpot(auth.token, auth.charId, auth.config, 'spirit_vein');
                        }
                    }

                    // Farming moved to dedicated interval below
                }
                console.log(` Cập nhật lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`===========================================================`);
            } catch (e) { }
        }, 3000);

        // 2. VÀO BÍ CẢNH NGAY LẬP TỨC
        // Sử dụng auth thay vì token, charId, config cục bộ
        const realmData = await bicanh.joinSecretRealm(auth.token, auth.charId, auth.config, activeMapCode);
        currentRealmId = realmData?.realm_id;

        await kyngo.enterKiNgo(auth.token, auth.charId, auth.config);
        latestMsg = await kyngo.getLatestLog(auth.token, auth.charId, auth.config);

        startCombatLoop();

        setInterval(() => manageOfflineAFK(), 600000);
        manageOfflineAFK();

        setInterval(() => manageBodyCult(), 300000); // 5 phút check Thể Tu một lần
        manageBodyCult();

        setInterval(() => manageGarden(), 300000); // 5 phút check Linh Điền một lần
        manageGarden();

        setInterval(() => manageChests(), 600000);
        manageChests();

        // Farm automation - use auth object to keep token fresh
        setInterval(async () => {
            try {
                await farm.harvestAndPlant(auth.token, auth.charId, auth.config);
            } catch (e) { }
        }, 120000);


        setInterval(async () => {
            try {
                const { token, charId, config } = auth;
                const reasons = [];
                if (latestHP < 30) reasons.push("Sinh lực");
                if (latestStamina < 30) reasons.push("Thể lực");
                if (latestSpirit < 30) reasons.push("Thân hồn");

                if (reasons.length === 0) {
                    await kyngo.triggerKiNgo(token, charId, config);
                    setTimeout(async () => {
                        try {
                            latestMsg = await kyngo.getLatestLog(token, charId, config);
                        } catch (e) { }
                    }, 2000);
                } else {
                    latestMsg = `[HỆ THỐNG] ${reasons.join("/")} thấp (<30), tạm dừng Kỳ Ngộ để hồi phục.`;
                }
            } catch (e) {
                // console.error('[ERROR Kỳ Ngộ]', e.message);
            }
        }, 31000);

    } catch (err) { console.error('[CRITICAL ERROR]', err.message); }
}

start();