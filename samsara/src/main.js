import { loginAndGetInfo, refreshTokenIfNeeded } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';
import * as farm from './farm.js';
import WebSocket from 'ws';

let auth = {
    token: null,
    charId: null,
    config: null,
    accountIndex: 0,
    expiresAt: 0
};

let latestMsg = "Đang khởi tạo...";
let killMsg = "Đang tải BXH...";
let bossMsg = "Đang tìm mục tiêu...";
let wbMsg = "Đang ở Bí Cảnh (Không săn Boss TG)";
let currentRealmId = null;
let activeMapCode = "sect_lk_c01";
let bodyPriority = "top_cp"; // Ưu tiên leo Top Tăng Lực Chiến
let currentMobId = null;
let currentMobKind = null;
let currentMobHP = 0;
let currentMobRetryCount = 0; // Số lần thử lại target quá xa
let scanCount = 0;
let combatLogs = [];
let attackFailureCount = 0;
let latestLevel = 0;

function logCombat(msg) {
    const time = new Date().toLocaleTimeString();
    combatLogs.unshift(`[${time}] ${msg}`);
    if (combatLogs.length > 5) combatLogs.pop();
}

let lastMPCheck = 0;
let mpRecoveredLastMinute = 0;
let mpCheckTime = Date.now();


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

            let target = bicanh.findNewTarget(snapshot, charId, auth.charId)

            if (target && target.id) {
                currentMobId = target.id;
                currentMobKind = target.mobKind;
                currentMobHP = target.hp || 0;
                currentMobRetryCount = 0;
                scanCount = 0;

                const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? "[BOSS] " : "";
                logCombat(`Target: ${kindLabel}${currentMobId.substring(0, 8)}... (Nhìn thấy ${target.totalMobs} quái)`);
            } else {
                const mobCount = target?.totalMobs || 0;
                bossMsg = `Map [${activeMapCode}] kô thấy mục tiêu... (Nhìn thấy ${mobCount} thực thể)`;

                // Nếu Map trống thực sự (>15 lần quét ~30s), thử join lại chính nó để refresh realm
                scanCount++;
                if (scanCount >= 15) {
                    process.stdout.write(`\r[HỆ THỐNG] Đang làm mới kết nối Bí Cảnh...                      `);
                    const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
                    currentRealmId = realmData?.realm_id || currentRealmId;
                    scanCount = 0;
                }
            }

            setTimeout(() => startCombatLoop(), currentMobId ? 0 : 2000);
            return;
        } catch (e) {
            setTimeout(() => startCombatLoop(), 5000);
            return;
        }
    }

    try {
        // TỰ ĐỘNG CẮN THUỐC TRONG CHIẾN ĐẤU (MP)
        if (latestMP < 60 && inventoryCounts['pill_lk_mp'] > 0) {
            await tracker.useItem(token, charId, config, 'pill_lk_mp');
            latestMP += 50; // Ước tính hồi 100 MP
        }

        // CHIẾN THUẬT LAI: 
        // - Nếu quái > 10,000 HP và đủ Mana: Dùng Kỹ năng (v3) để lấy điểm.
        // - Nếu quái <= 10,000 HP hoặc hết Mana: Dùng Đánh tay (v1) để tiết kiệm.
        let useNormalAttack = true;
        if (currentMobHP < 5000 && latestMP > 20) {
            useNormalAttack = false;
        }

        const startTime = Date.now();
        const res = await bicanh.attackMob(token, charId, config, currentRealmId, currentMobId);
        const latency = Date.now() - startTime;

        let nextWait = 2000;

        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            attackFailureCount = 0;
            if (res.mp_after !== undefined) latestMP = res.mp_after;
            if (res.hp_after !== undefined) latestHP = res.hp_after;
            if (res.mob_hp_after !== undefined) currentMobHP = res.mob_hp_after;

            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            const mode = useNormalAttack ? "[TAY] " : "[CHIÊU] ";
            const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? `[${currentMobKind.toUpperCase()}] ` : "";
            bossMsg = `${kindLabel}${mode}${res.is_crit ? "[BẠO!] " : ""}Gây: -${res.damage ?? 0} HP ${hpLeft}`;

            logCombat(bossMsg);

            // Tối ưu thời gian chờ dựa trên Atk Speed từ server
            const serverWait = res.atk_speed_sec ? (res.atk_speed_sec * 1000) : 2000;

            // Bù trừ latency: lấy thời gian hồi chiêu trừ đi thời gian mạng đã trôi qua
            nextWait = Math.max(100, serverWait - latency + 80); // 80ms buffer an toàn

            if (res.mob_hp_after !== undefined && res.mob_hp_after <= 0) {
                currentMobId = null;
                currentMobKind = null;
                nextWait = 100; // Chuyển mục tiêu mới ngay lập tức
            }
        } else {
            attackFailureCount++;
            if (attackFailureCount >= 5) {
                logCombat(`[CẢNH BÁO] 5 lần đánh không phản hồi, đang Re-join Bí cảnh...`);
                const realmData = await bicanh.joinSecretRealm(token, charId, config, activeMapCode);
                if (realmData && realmData.realm_id) {
                    currentRealmId = realmData.realm_id;
                    attackFailureCount = 0;
                    currentMobId = null;
                    logCombat(`✅ Đã Re-join thành công! Instance mới: ${currentRealmId}`);
                }
                nextWait = 3000;
            } else if (res?.reason === 'attack_cooldown') {
                attackFailureCount = 0; // Reset vì vẫn có phản hồi từ server
                nextWait = (res.remain_sec * 1000) + 200;
            } else if (res?.reason === 'no_mana') {
                attackFailureCount = 0;
                latestMP = 0;
                logCombat(`[HỆ THỐNG] Hết MP, chuyển sang Đánh TAY...`);
                nextWait = 500;
            } else if (res?.reason === 'target_out_of_range') {
                attackFailureCount = 0;
                bossMsg = `[CẢNH BÁO] Mục tiêu ngoài tầm đánh! Đang đợi quái di chuyển...`;
                nextWait = 2000;
            } else if (res?.reason === 'not_found' || res?.reason === 'target_is_dead') {
                attackFailureCount = 0;
                currentMobId = null;
                currentMobKind = null;
                nextWait = 200;
            } else {
                const reason = res?.reason || res?.message || 'Không có phản hồi';
                bossMsg = `[LỖI] ${reason}`;
                if (res?.status) bossMsg += ` (HTTP ${res.status})`;
                logCombat(bossMsg);
                nextWait = 2000;
            }
        }
        setTimeout(() => startCombatLoop(), nextWait);
    } catch (e) {
        currentMobId = null;
        setTimeout(() => startCombatLoop(), 5000);
    }
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
            } else if (bodyPriority === 'top_cp') {
                const offensive = ['fire', 'metal'];
                let bestOffensive = offensive.find(el => {
                    const cost = body.next_upgrade_cost[el];
                    const stoneKey = el === 'fire' ? 'hoa' : 'kim';
                    return (body.stones[`${stoneKey}_linh_thach`] || 0) >= cost.stone_cost;
                });

                if (bestOffensive) targetEl = bestOffensive;
                else {
                    let cheapestCost = 999999;
                    for (const el of elements) {
                        const cost = body.next_upgrade_cost[el].ss_cost;
                        if (cost < cheapestCost) {
                            cheapestCost = cost;
                            targetEl = el;
                        }
                    }
                }
            } else {
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
                    latestLevel = status.level || 0;
                    const res = data.home.resources || {};
                    const wallet = data.home.wallet || {};

                    latestHP = res.hp || 0;
                    latestMP = res.mp || 0;
                    latestStamina = res.stamina || 0;
                    latestSpirit = res.spirit || 0;
                    spiritStones = wallet.spirit_stones || 0;

                    inventoryCounts = {};
                    if (Array.isArray(inv)) inv.forEach(item => inventoryCounts[item.code] = item.qty);

                    const now = Date.now();
                    // Tính toán mana hồi phục
                    if (lastMPCheck > 0 && latestMP > lastMPCheck) {
                        mpRecoveredLastMinute += (latestMP - lastMPCheck);
                    }
                    // Mỗi 60s in log và reset
                    if (now - mpCheckTime >= 60000) {
                        process.stdout.write(`\n[THỐNG KÊ] Tốc độ hồi Mana: +${mpRecoveredLastMinute} MP/phút.           \n`);
                        mpRecoveredLastMinute = 0;
                        mpCheckTime = now;
                    }
                    lastMPCheck = latestMP;

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
                    combatLogs.slice(0, 5).forEach(log => console.log(`    > ${log}`));
                    console.log(` [TOP DIỆT QUÁI]: ${killMsg}`);
                    console.log(` [KỲ NGỘ]: ${latestMsg}`);

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

                    if (status.cultivation_exp_progress + status.claimable_exp >= status.exp_to_next && ![10, 20, 30].includes(status.level)) {
                        if (status.claimable_exp > 0) await tracker.claimExp(auth.token, auth.charId, auth.config);
                        else await tracker.doBreakthrough(auth.token, auth.charId, auth.config);
                    }


                    // Tự động chuyển chỗ tu luyện bị vô hiệu hóa theo yêu cầu (Bỏ qua Ancient Cave)
                    /*
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
                    */

                    // Farming moved to dedicated interval below
                }
                console.log(` Cập nhật lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`===========================================================`);
            } catch (e) { }
        }, 3000);

        // 1. NHẬN THƯỞNG OFFLINE (Nếu có)
        try {
            console.log(`[HỆ THỐNG] Đang kiểm tra quà Offline...`);
            const afkRes = await tracker.claimOfflineAFK(auth.token, auth.charId, auth.config);
            if (afkRes && afkRes.reward) {
                console.log(`    > [CƠ BẢN] Nhận : ${JSON.stringify(afkRes.reward)}`);
            }

            const realmAfkRes = await bicanh.claimSecretRealmOfflineAFK(auth.token, auth.charId, auth.config);
            if (realmAfkRes && (realmAfkRes.reward || realmAfkRes.message)) {
                console.log(`    > [BÍ CẢNH] Nhận : ${realmAfkRes.message || JSON.stringify(realmAfkRes.reward)}`);
            }


            // ✅ GỌI AFK NGAY KHI START
            await goOffline();

            // KIỂM TRA AFK MỖI 30S
            setInterval(async () => {
                try {
                    const previewRes = await bicanh.previewSecretRealmOfflineAFK(auth.token, auth.charId, auth.config);
                    if (previewRes && previewRes.ok) {
                        if (previewRes.elapsed_sec >= previewRes.max_duration_sec) {
                            console.log(`\n[HỆ THỐNG] Đã đạt giới hạn AFK Bí cảnh (${previewRes.max_duration_sec}s), đang nhận thưởng...`);
                            await bicanh.claimSecretRealmOfflineAFK(auth.token, auth.charId, auth.config);
                            await goOffline();
                        }
                    }
                } catch (e) {}
            }, 30000);

        } catch (e) { }

        // 2. KHỞI ĐỘNG REALTIME SOCKET
        connectRealtime(auth.config);

        // 3. VÀO BÍ CẢNH NGAY LẬP TỨC
        // Sử dụng auth thay vì token, charId, config cục bộ
        const realmData = await bicanh.joinSecretRealm(auth.token, auth.charId, auth.config, activeMapCode);
        currentRealmId = realmData?.realm_id;

        await kyngo.enterKiNgo(auth.token, auth.charId, auth.config);
        latestMsg = await kyngo.getLatestLog(auth.token, auth.charId, auth.config);

        startCombatLoop();



        setInterval(() => manageBodyCult(), 30000); // 30 giây check Thể Tu một lần
        manageBodyCult();

        setInterval(() => manageGarden(), 300000); // 5 phút check Linh Điền một lần
        manageGarden();

        setInterval(() => manageChests(), 60000); // 1 phút check rương một lần
        manageChests();


        // Farm automation - use auth object to keep token fresh
        setInterval(async () => {
            try {
                await farm.harvestAndPlant(auth.token, auth.charId, auth.config);
            } catch (e) { }
        }, 120000);

        // 5. Cập nhật BXH Diệt quái (Mỗi 5 phút)
        setInterval(async () => {
            try {
                const res = await tracker.getWeeklyContestStatus(auth.token, auth.charId, auth.config);
                if (res) {
                    const topArray = res.top || res.top_players || [];

                    // 1. Tìm thông tin của mình trong danh sách Top
                    const myId = String(auth.charId).toLowerCase();
                    const myIndex = topArray.findIndex(p => String(p.character_id).toLowerCase() === myId);

                    let myRank = Number(res.my_rank || 0);
                    let myScore = Number(res.my_score ?? res.score ?? 0);

                    if (myIndex !== -1) {
                        myRank = Number(topArray[myIndex].rank || myIndex + 1);
                        myScore = Number(topArray[myIndex].score || topArray[myIndex].my_score || 0);
                    }

                    const top1Name = topArray[0] ? (topArray[0].character_name || "Top 1") : "Chưa có";
                    const top1Score = topArray[0] ? Number(topArray[0].score || topArray[0].my_score || 0) : 0;
                    const top1 = topArray[0] ? `${top1Name} (${top1Score})` : "Chưa có";

                    let gapNextMsg = "";
                    let gap1Msg = "";

                    // Khoảng cách tới người xếp ngay trên
                    if (myIndex > 0) {
                        const nextPlayer = topArray[myIndex - 1];
                        const nextScore = Number(nextPlayer.score || nextPlayer.my_score || 0);
                        const nextRank = nextPlayer.rank || myIndex;
                        gapNextMsg = ` | Thua Hạng ${nextRank}: ${nextScore - myScore} pts`;
                    } else if (myIndex === -1 && topArray.length > 0) {
                        const lastPlayer = topArray[topArray.length - 1];
                        const lastScore = Number(lastPlayer.score || lastPlayer.my_score || 0);
                        const lastRank = lastPlayer.rank || topArray.length;
                        gapNextMsg = ` | Thua Top ${lastRank}: ${lastScore - myScore} pts`;
                    }

                    // Khoảng cách tới Top 1
                    if (myRank > 1 && top1Score > 0) {
                        gap1Msg = ` | Thua Top 1: ${top1Score - myScore} pts`;
                    }

                    killMsg = `Hạng: ${myRank || 'N/A'} - Điểm: ${myScore}${gapNextMsg}${gap1Msg} | Top 1: ${top1}`;
                }
            } catch (e) { }
        }, 5000);

        setInterval(async () => {
            try {
                const { token, charId, config } = auth;
                const reasons = [];
                if (latestHP < 30) reasons.push("Sinh lực");
                if (latestStamina < 30) reasons.push("Thể lực");
                if (latestSpirit < 30) reasons.push("Thân hồn");
                if ([10, 20, 30].includes(latestLevel)) reasons.push("Cấp độ (" + latestLevel + ")");

                if (reasons.length === 0) {
                    await kyngo.triggerKiNgo(token, charId, config);
                    setTimeout(async () => {
                        try {
                            latestMsg = await kyngo.getLatestLog(token, charId, config);
                        } catch (e) { }
                    }, 2000);
                } else {
                    latestMsg = `[HỆ THỐNG] Tạm dừng Kỳ Ngộ do: ${reasons.join(", ")}.`;
                }
            } catch (e) {
                // console.error('[ERROR Kỳ Ngộ]', e.message);
            }
        }, 31000);

    } catch (err) { console.error('[CRITICAL ERROR]', err.message); }
}

function connectRealtime(config) {
    const wsUrl = `wss://${config.SUPABASE_URL.split('//')[1]}/realtime/v1/websocket?apikey=${config.API_KEY}&vsn=1.0.0`;
    let ws = new WebSocket(wsUrl);
    let heartbeatInterval;
    let ref = 0;

    ws.on('open', () => {
        console.log('\n[REALTIME] Kết nối thành công! Đã bật trạng thái Online.');
        // Gửi Join vào kênh phoenix
        ws.send(JSON.stringify({
            topic: "phoenix",
            event: "phx_join",
            payload: {},
            ref: String(++ref)
        }));

        // Gửi Heartbeat mỗi 30s
        heartbeatInterval = setInterval(() => {
            ws.send(JSON.stringify({
                topic: "phoenix",
                event: "heartbeat",
                payload: {},
                ref: String(++ref)
            }));
        }, 30000);
    });

    ws.on('error', (err) => {
        // console.error('[REALTIME ERROR]', err.message);
    });

    ws.on('close', () => {
        console.log('[REALTIME] Mất kết nối. Đang thử lại sau 5s...');
        clearInterval(heartbeatInterval);
        setTimeout(() => connectRealtime(config), 5000);
    });

    return ws;
}

async function goOffline() {
    const { token, charId, config } = auth;
    if (!token || !charId) return;
    try {
        console.log(`\n[HỆ THỐNG] Đang thiết lập trạng thái Offline AFK tại: bf_tay_bac_c01...`);
        const res = await tracker.startOfflineAFK(token, charId, config, "bf_tay_bac_c01");
        if (res && res.ok) {
            console.log(`    > Thành công! Bạn có thể yên tâm nghỉ ngơi.`);
        }
    } catch (e) {
        console.error('[OFFLINE ERROR]', e.message);
    }
}

// Bắt sự kiện tắt script để tự động đi AFK
process.on('SIGINT', async () => {
    await goOffline();
    process.exit();
});

start();