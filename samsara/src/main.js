import { loginAndGetInfo, refreshTokenIfNeeded } from './login.js';
import * as tracker from './track.js';
import * as kyngo from './ky_ngo.js';
import * as bicanh from './secret_realm.js';
import * as farm from './farm.js';
import WebSocket from 'ws';

import { state } from './state.js';
import { logCombat } from './logger.js';
import { renderUI } from './ui.js';

let auth = {
    token: null,
    charId: null,
    config: null,
    accountIndex: 0,
    expiresAt: 0
};

let currentMobId = null;
let currentMobKind = null;
let currentMobHP = 0;
let currentMobRetryCount = 0;
let scanCount = 0;
let attackFailureCount = 0;

let lastMPCheck = 0;
let mpRecoveredLastMinute = 0;
let mpCheckTime = Date.now();

const fmtTime = (s) => {
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sc = Math.floor(s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sc}`;
};


let mapSequence = [];
let mapIndex = 0;

async function startCombatLoop() {
    const { token, charId, config } = auth;

    if (!currentMobId) {
        try {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, state.realmId);

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
                state.messages.boss = `Map [${state.activeMapCode}] kô thấy mục tiêu... (Nhìn thấy ${mobCount} thực thể)`;

                // Nếu Map trống thực sự (>15 lần quét ~30s), thử join lại chính nó để refresh realm
                scanCount++;
                if (scanCount >= 15) {
                    const realmData = await bicanh.joinSecretRealm(token, charId, config, state.activeMapCode);
                    state.realmId = realmData?.realm_id || state.realmId;
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
        if (state.mp < 60 && state.inventory['pill_lk_mp'] > 0) {
            await tracker.useItem(token, charId, config, 'pill_lk_mp');
            state.mp += 50; // Ước tính hồi 100 MP
        }

        // CHIẾN THUẬT LAI: 
        // - Nếu quái > 10,000 HP và đủ Mana: Dùng Kỹ năng (v3) để lấy điểm.
        // - Nếu quái <= 10,000 HP hoặc hết Mana: Dùng Đánh tay (v1) để tiết kiệm.
        let useNormalAttack = true;
        if (currentMobHP < 5000 && state.mp > 20) {
            useNormalAttack = false;
        }

        const startTime = Date.now();
        const res = await bicanh.attackMob(token, charId, config, state.realmId, currentMobId);
        const latency = Date.now() - startTime;

        let nextWait = 2000;

        if (res && res.httpOk && (res.ok || res.damage !== undefined)) {
            attackFailureCount = 0;
            if (res.mp_after !== undefined) state.mp = res.mp_after;
            if (res.hp_after !== undefined) state.hp = res.hp_after;
            if (res.mob_hp_after !== undefined) currentMobHP = res.mob_hp_after;

            const hpLeft = res.mob_hp_after !== undefined ? `| Quái còn: ${res.mob_hp_after}` : "";
            const mode = useNormalAttack ? "[TAY] " : "[CHIÊU] ";
            const kindLabel = (currentMobKind === 'boss' || currentMobKind === 'elite') ? `[${currentMobKind.toUpperCase()}] ` : "";
            state.messages.boss = `${kindLabel}${mode}${res.is_crit ? "[BẠO!] " : ""}Gây: -${res.damage ?? 0} HP ${hpLeft}`;

            logCombat(state.messages.boss);

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
                const realmData = await bicanh.joinSecretRealm(token, charId, config, state.activeMapCode);
                if (realmData && realmData.realm_id) {
                    state.realmId = realmData.realm_id;
                    attackFailureCount = 0;
                    currentMobId = null;
                    logCombat(`✅ Đã Re-join thành công! Instance mới: ${state.realmId}`);
                }
                nextWait = 3000;
            } else if (res?.reason === 'attack_cooldown') {
                attackFailureCount = 0; // Reset vì vẫn có phản hồi từ server
                nextWait = (res.remain_sec * 1000) + 200;
            } else if (res?.reason === 'no_mana') {
                attackFailureCount = 0;
                state.mp = 0;
                logCombat(`[HỆ THỐNG] Hết MP, chuyển sang Đánh TAY...`);
                nextWait = 500;
            } else if (res?.reason === 'target_out_of_range') {
                attackFailureCount = 0;
                state.messages.boss = `[CẢNH BÁO] Mục tiêu ngoài tầm đánh! Đang đợi quái di chuyển...`;
                nextWait = 2000;
            } else if (res?.reason === 'not_found' || res?.reason === 'target_is_dead') {
                attackFailureCount = 0;
                currentMobId = null;
                currentMobKind = null;
                nextWait = 200;
            } else {
                const reason = res?.reason || res?.message || 'Không có phản hồi';
                state.messages.boss = `[LỖI] ${reason}`;
                if (res?.status) state.messages.boss += ` (HTTP ${res.status})`;
                logCombat(state.messages.boss);
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
                        state.messages.latest = `[HỆ THỐNG] Đã thu hoạch ${plot.seed_name} tại ô ${plot.slot}`;
                    }
                }
            }

            // 2. Gieo hạt nếu trống
            if (!plot.seed_code) {
                // Lấy hạt giống trong kho
                const inv = Object.keys(state.inventory).filter(code => code.startsWith('seed_') && state.inventory[code] > 0);
                if (inv.length > 0) {
                    const seed = inv[0]; // Lấy hạt đầu tiên tìm thấy
                    const plant = await tracker.plantCrop(token, charId, config, plot.slot, seed);
                    if (plant && plant.ok) {
                        state.inventory[seed]--;
                        state.messages.latest = `[HỆ THỐNG] Đã gieo ${seed} vào ô ${plot.slot}`;
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
                    state.messages.latest = `[HỆ THỐNG] Đã nhận phần thưởng Luyện Thể hệ ${body.training_session.element.toUpperCase()}`;
                }
            }
        }

        // 2. Nếu không có phiên nào đang chạy, bắt đầu phiên mới
        const elements = ['fire', 'wood', 'water', 'earth', 'metal'];
        if (!body.training_session || (body.training_session.status !== 'active')) {
            let targetEl = 'fire';

            if (state.bodyPriority === 'power') {
                targetEl = 'fire';
            } else if (state.bodyPriority === 'survival') {
                targetEl = 'wood';
            } else if (state.bodyPriority === 'top_cp') {
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
                state.messages.latest = `[HỆ THỐNG] Bắt đầu Luyện Thể hệ ${targetEl.toUpperCase()} (8 giờ) - Chế độ: ${state.bodyPriority}`;
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
                    state.messages.latest = `[HỆ THỐNG] Nâng cấp Thể Tu hệ ${el.toUpperCase()} thành công!`;
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
            state.messages.latest = `[HỆ THỐNG] Mở rương: ${msg}`;
        }
    } catch (e) { }
}

async function manageAlchemy() {
    const { token, charId, config } = auth;
    try {
        const recipeCode = "r_pill_lk_sta";
        const res = await tracker.rpcCall(token, charId, config, 'rpc_craft_auto', {
            p_character_id: charId,
            p_recipe_code: recipeCode,
            p_times: 1
        });

        if (res && res.success) {
            state.messages.alchemy = `${res.message || 'Thành công 1 đan'}`;
        } else {
            const errorMsg = res?.message || "Hết nguyên liệu";
            state.messages.alchemy = `${errorMsg}`;
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

        state.activeMapCode = auth.userData.map_code || mapSequence[0];
        state.accountIndex = accountIndex;
        mapIndex = mapSequence.indexOf(state.activeMapCode);
        if (mapIndex === -1) mapIndex = 0;


        // 1. CHẠY DASHBOARD
        setInterval(async () => {
            try {
                const res = await tracker.getRebirthQuestProgress(auth.token, auth.charId, auth.config);
                if (res && res.quest) {
                    const q = res.quest;
                    const prog = q.progress || {};
                    const targets = q.targets || {};
                    state.quest.rank = q.rank_label || "N/A";
                    state.quest.level = `${prog.levels_gained || 0}/${q.realm_max_level || 0}`;
                    state.quest.mobs = `${prog.mobs_killed || 0}/${targets.mobs_killed || 0}`;
                    state.quest.elite = `${prog.elites_killed || 0}/${targets.elites_killed || 0}`;
                    state.quest.boss = `${prog.bosses_killed || 0}/${targets.bosses_killed || 0}`;
                    state.quest.pvp = `${prog.pvp_kills || 0}/${targets.pvp_kills || 0}`;
                    state.quest.craft = `${prog.craft_successes || 0}/${targets.craft_successes || 0}`;
                }
            } catch (e) { }
        }, 10000);

        // Chạy lần đầu ngay lập tức
        tracker.getRebirthQuestProgress(auth.token, auth.charId, auth.config).then(res => {
            if (res && res.quest) {
                const q = res.quest;
                const prog = q.progress || {};
                const targets = q.targets || {};
                state.quest.rank = q.rank_label || "N/A";
                state.quest.level = `${prog.levels_gained || 0}/${q.realm_max_level || 0}`;
                state.quest.mobs = `${prog.mobs_killed || 0}/${targets.mobs_killed || 0}`;
                state.quest.elite = `${prog.elites_killed || 0}/${targets.elites_killed || 0}`;
                state.quest.boss = `${prog.bosses_killed || 0}/${targets.bosses_killed || 0}`;
                state.quest.pvp = `${prog.pvp_kills || 0}/${targets.pvp_kills || 0}`;
                state.quest.craft = `${prog.craft_successes || 0}/${targets.craft_successes || 0}`;
            }
        }).catch(() => { });

        setInterval(async () => {
            try {
                // Kiểm tra và refresh token nếu cần
                const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
                if (newAuth) {
                    Object.assign(auth, newAuth);
                }

                const { token, charId, config } = auth;
                const data = await tracker.getStatus(token, charId, config);
                const inv = await tracker.listInventory(token, charId, config);

                if (data?.cultivation_status && data?.home) {
                    const status = data.cultivation_status;
                    state.charName = data.home.character.name;
                    state.latestLevel = status.level || 0;
                    const res = data.home.resources || {};
                    const wallet = data.home.wallet || {};

                    state.hp = res.hp || 0;
                    state.mp = res.mp || 0;
                    state.stamina = res.stamina || 0;
                    state.spirit = res.spirit || 0;
                    state.spiritStones = wallet.spirit_stones || 0;

                    state.exp.current = status.cultivation_exp_progress;
                    state.exp.next = status.exp_to_next;
                    state.exp.percent = (((status.cultivation_exp_progress + status.claimable_exp) / status.exp_to_next) * 100).toFixed(2);
                    state.exp.claimable = status.claimable_exp;

                    state.inventory = {};
                    if (Array.isArray(inv)) inv.forEach(item => state.inventory[item.code] = item.qty);

                    const now = Date.now();
                    if (lastMPCheck > 0 && state.mp > lastMPCheck) {
                        mpRecoveredLastMinute += (state.mp - lastMPCheck);
                    }
                    if (now - mpCheckTime >= 60000) {
                        mpRecoveredLastMinute = 0;
                        mpCheckTime = now;
                    }
                    lastMPCheck = state.mp;

                    renderUI();

                    if (state.hp < 1000 && state.inventory['pill_lk_hp'] > 0) await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_hp');
                    if (state.stamina < 30 && state.inventory['pill_lk_sta'] > 0) await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_sta');
                    if (state.spirit < 30 && (state.inventory['pill_lk_spirit'] || 0) >= 5) await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_spirit');
                    if (state.mp < 50 && (state.inventory['pill_lk_mp'] || 0) >= 1) await tracker.useItem(auth.token, auth.charId, auth.config, 'pill_lk_mp');

                    if (parseFloat(state.exp.percent) >= 100 && ![10, 20, 30].includes(status.level)) {
                        if (status.claimable_exp > 0) await tracker.claimExp(auth.token, auth.charId, auth.config);
                        else await tracker.doBreakthrough(auth.token, auth.charId, auth.config);
                    }
                }
            } catch (e) { }
        }, 3000);

        // 1. NHẬN THƯỞNG OFFLINE (Nếu có)
        try {
            // state.messages.latest = `[HỆ THỐNG] Đang kiểm tra quà Offline...`;
            // const afkRes = await tracker.claimOfflineAFK(auth.token, auth.charId, auth.config);
            // if (afkRes && afkRes.reward) {
            //     state.messages.latest = `[AFK] Nhận quà cơ bản: ${JSON.stringify(afkRes.reward)}`;
            // }

            // const realmAfkRes = await bicanh.claimSecretRealmOfflineAFK(auth.token, auth.charId, auth.config);
            // if (realmAfkRes && (realmAfkRes.reward || realmAfkRes.message)) {
            //     state.messages.latest = `[AFK Bí Cảnh] ${realmAfkRes.message || JSON.stringify(realmAfkRes.reward)}`;
            // }


            // ✅ GỌI AFK NGAY KHI START
            await goOffline();

            // KIỂM TRA AFK MỖI 30S
            setInterval(async () => {
                try {
                    const previewRes = await bicanh.previewSecretRealmOfflineAFK(auth.token, auth.charId, auth.config);
                    if (previewRes && previewRes.ok) {
                        state.messages.afk = `${fmtTime(previewRes.elapsed_sec)} / ${fmtTime(previewRes.max_duration_sec)}`;

                        if (previewRes.elapsed_sec >= previewRes.max_duration_sec) {
                            state.messages.latest = `[HỆ THỐNG] Đạt giới hạn AFK Bí cảnh, đang nhận thưởng...`;
                            await bicanh.claimSecretRealmOfflineAFK(auth.token, auth.charId, auth.config);
                            await goOffline();
                        }
                    } else {
                        await goOffline();
                    }
                } catch (e) { }
            }, 30000);

        } catch (e) { }

        // 2. KHỞI ĐỘNG REALTIME SOCKET
        connectRealtime(auth.config);

        // 3. VÀO BÍ CẢNH NGAY LẬP TỨC
        // Sử dụng auth thay vì token, charId, config cục bộ
        const realmData = await bicanh.joinSecretRealm(auth.token, auth.charId, auth.config, state.activeMapCode);
        state.realmId = realmData?.realm_id;

        await kyngo.enterKiNgo(auth.token, auth.charId, auth.config);
        state.messages.latest = await kyngo.getLatestLog(auth.token, auth.charId, auth.config);

        startCombatLoop();



        // setInterval(() => manageBodyCult(), 30000); // 30 giây check Thể Tu một lần
        // manageBodyCult();

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

                    state.ranking.rank = myRank || 0;
                    state.ranking.score = myScore;

                    if (myIndex > 0) {
                        const nextPlayer = topArray[myIndex - 1];
                        state.ranking.gapNext = Number((nextPlayer.score || nextPlayer.my_score || 0)) - myScore;
                    } else if (myIndex === -1 && topArray.length > 0) {
                        const lastPlayer = topArray[topArray.length - 1];
                        state.ranking.gapNext = Number((lastPlayer.score || lastPlayer.my_score || 0)) - myScore;
                    } else {
                        state.ranking.gapNext = 0;
                    }

                    if (myRank > 1 && top1Score > 0) {
                        state.ranking.gapTop = top1Score - myScore;
                    } else {
                        state.ranking.gapTop = 0;
                    }
                }
            } catch (e) { }
        }, 5000);

        setInterval(async () => {
            try {
                const { token, charId, config } = auth;
                const reasons = [];
                if (state.hp < 30) reasons.push("Sinh lực");
                if (state.stamina < 30) reasons.push("Thể lực");
                if (state.spirit < 30) reasons.push("Thân hồn");
                if ([10, 20, 30].includes(state.latestLevel)) reasons.push("Cấp độ (" + state.latestLevel + ")");

                if (reasons.length === 0) {
                    await kyngo.triggerKiNgo(token, charId, config);
                    setTimeout(async () => {
                        try {
                            const log = await kyngo.getLatestLog(token, charId, config);
                            state.messages.latest = log;
                            if (log.includes("PK") || log.includes("Thắng") || log.includes("Thất Bại")) {
                                state.messages.pvp = log;
                            }
                        } catch (e) { }
                    }, 2000);
                } else {
                    state.messages.latest = `[HỆ THỐNG] Tạm dừng Kỳ Ngộ do: ${reasons.join(", ")}.`;
                }
            } catch (e) {
                // console.error('[ERROR Kỳ Ngộ]', e.message);
            }
        }, 31000);

    } catch (err) { console.error('[CRITICAL ERROR]', err.message); }
}

function connectRealtime(config) {
    return
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