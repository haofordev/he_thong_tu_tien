import fs from 'fs';
import crypto from 'crypto';

/** 
 * CÀI ĐẶT THÔNG SỐ TẠI ĐÂY 
 */
const BASE_URL = 'https://tuchangioi.online';
const SECRET_KEY = "h0yvgF4WvRSgr+1yvkYea446EX8DMs40+pt0RnWO1Jk=";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CONFIG_PATH = './config/data.json';
const TOKEN_FILE = './config/main_token.txt';
const GUESS_SYNC_FILE = './config/guess_sync.json';

// --- Nhật ký hệ thống ---
let actionLogs = [];
function addLog(msg, type = 'info') {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    const symbols = { info: 'ℹ', success: '✔', warn: '⚠', error: '✘' };
    actionLogs.unshift(`[${time}] ${symbols[type] || '•'} ${msg}`);
    if (actionLogs.length > 8) actionLogs.pop();
}

// --- Các hàm tiện ích ---

function formatNum(num) {
    if (typeof num !== 'number') num = Number(num || 0);
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + " Tỷ";
    if (num >= 1000000) return (num / 1000000).toFixed(2) + " Tr";
    if (num >= 1000) return (num / 1000).toFixed(1) + " K";
    return num.toString();
}

function hp(payload) {
    if (!payload || Object.keys(payload).length === 0) return "";
    return Object.keys(payload).sort().map(k => `${k}${payload[k]}`).join("");
}

function generateSignature(playerName, action, payload, timestamp) {
    const dataStr = `${playerName}${action}${hp(payload)}${timestamp}${USER_AGENT}`;
    return crypto.createHmac('sha256', SECRET_KEY).update(dataStr).digest('hex');
}

function generateLoginSignature(username, password, timestamp) {
    const dataStr = `${username}${password}${timestamp}${USER_AGENT}`;
    return crypto.createHmac('sha256', SECRET_KEY).update(dataStr).digest('hex');
}

async function apiRequest(endpoint, method = "GET", payload = null, token = null, playerName = null) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { 'User-Agent': USER_AGENT, 'X-Client-ID': 'tu-tien-terminal-bot' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let body = null;
    if (method === "POST") {
        const timestamp = Date.now();
        const action = "-" + endpoint.split("/").pop();
        if (playerName && !endpoint.includes("/auth/login")) {
            body = JSON.stringify({
                ...(payload || {}), action: action, timestamp: timestamp,
                signature: generateSignature(playerName, action, payload, timestamp)
            });
        } else { body = JSON.stringify(payload); }
        headers['Content-Type'] = 'application/json';
    }

    try {
        const res = await fetch(url, { method, headers, body });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `Lỗi API ${res.status}`);
        return data;
    } catch (e) { throw new Error(e.message); }
}

async function runBot() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    let token = null, playerName = "", lastGuessTime = 0, lastMineCheck = 0, lastHarvestTime = 0, lastSyncTime = 0, lastTowerTime = 0, mineStatus = "Đang kiểm tra...";
    let guessLow = 1, guessHigh = 10000, currentGuess = 5000, lastSyncedWinner = "", playerCount = 0;
    const C = {
        res: "\x1b[0m",
        cyan: "\x1b[36m",
        gre: "\x1b[32m",
        yel: "\x1b[33m",
        mag: "\x1b[35m",
        red: "\x1b[31m",
        blu: "\x1b[34m",
        bri: "\x1b[1m",
        dim: "\x1b[2m",
        bg_blu: "\x1b[44m"
    };

    if (fs.existsSync(TOKEN_FILE)) token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (token) {
        try { playerName = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).name; } catch (e) { token = null; }
    }

    if (!token) {
        addLog("Đang tiến hành đăng nhập...", 'info');
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            const ts = Date.now();
            const loginPayload = { username: config.email, password: config.password, signature: generateLoginSignature(config.email, config.password, ts), timestamp: ts, turnstileToken: "dev-mock-token-" + Date.now() };
            const loginData = await apiRequest("/api/auth/login", "POST", loginPayload);
            token = loginData.token; playerName = loginData.playerName;
            fs.writeFileSync(TOKEN_FILE, token);
            addLog(`Đăng nhập thành công: ${playerName}`, 'success');
        } catch (e) { return console.log("[Login Error]", e.message); }
    }

    addLog("Bắt đầu chu kỳ tu luyện Chân Giới (MAIN ACCOUNT)...", 'success');

    while (true) {
        try {
            // Đồng bộ thời gian đoán số từ file (để chính xác khi chạy nhiều bot hoặc restart)
            if (fs.existsSync(GUESS_SYNC_FILE)) {
                try {
                    const syncData = JSON.parse(fs.readFileSync(GUESS_SYNC_FILE, 'utf8'));
                    if (syncData[playerName]?.lastGuessTime) {
                        lastGuessTime = syncData[playerName].lastGuessTime;
                    }
                } catch (e) { }
            }

            const [data, gameData, activeEventsData] = await Promise.all([
                apiRequest("/api/load", "GET", null, token),
                apiRequest("/api/game-data", "GET"),
                apiRequest("/api/events/active", "GET", null, token)
            ]);

            const player = data.player;
            const activeEvents = activeEventsData || [];
            const currentRealm = gameData.REALMS[player.realmIndex];
            const stones = Number(player.linh_thach || 0);
            const bodyPower = player.body_power || 0;
            const lastChallenges = data.lastChallengeTime || {};

            // Tính toán tỷ lệ đột phá và tốc độ tu luyện thực tế
            const calcBreakthroughBreakdown = (p, gd, activeEvts) => {
                const breakdown = [];
                const e = p;
                const t = gd;
                const a = activeEvts || [];

                // 1. Công pháp
                if (e.activeTechniqueId) {
                    const tech = t.TECHNIQUES.find(y => y.id === e.activeTechniqueId);
                    tech?.bonuses.forEach(y => {
                        if (y.type === "breakthrough_chance_add" && y.value !== 0) {
                            breakdown.push({ source: `Công pháp (${tech.name})`, value: y.value });
                        }
                    });
                }

                // 2. Trang bị
                let equipBonus = 0;
                e.equipment.forEach(p_eq => {
                    const bonuses = Qc_local(p_eq, t);
                    bonuses.forEach(m => {
                        if (m.type === "breakthrough_chance_add") equipBonus += m.value;
                    });
                });
                if (equipBonus !== 0) breakdown.push({ source: "Trang bị", value: equipBonus });

                // 3. Linh căn
                let rootBonus = 0;
                if (e.spiritualRoot && t.SPIRITUAL_ROOTS) {
                    const rootRecord = t.SPIRITUAL_ROOTS.find(y => y.id === e.spiritualRoot);
                    if (rootRecord && rootRecord.bonus) {
                        (Array.isArray(rootRecord.bonus) ? rootRecord.bonus : [rootRecord.bonus]).forEach(m => {
                            if (m.type === "breakthrough_chance_add" && m.value !== 0) rootBonus += m.value;
                        });
                    }
                }
                if (rootBonus !== 0) breakdown.push({ source: "Linh căn", value: rootBonus });

                // 4. Lĩnh ngộ
                let insightBonus = 0;
                if (e.unlockedInsights && t.INSIGHTS) {
                    e.unlockedInsights.forEach(p_insId => {
                        const insightRecord = t.INSIGHTS.find(m => m.id === p_insId);
                        insightRecord?.bonus && (Array.isArray(insightRecord.bonus) ? insightRecord.bonus : [insightRecord.bonus]).forEach(h => {
                            if (h.type === "breakthrough_chance_add" && h.value !== 0) insightBonus += h.value;
                        });
                    });
                }
                if (insightBonus !== 0) breakdown.push({ source: "Lĩnh ngộ", value: insightBonus });

                // 5. Phúc lợi Tông Môn
                const guildBonus = pf_local(e.guildLevel).breakthroughBonus;
                if (guildBonus > 0) breakdown.push({ source: "Phúc lợi Tông Môn", value: guildBonus });

                // 6. Phúc lợi thất bại
                let failBonus = 0;
                if (e.breakthrough_consecutive_failures > 0) {
                    (t.BREAKTHROUGH_FAILURE_BONUSES || []).filter(y => y.failure_count <= e.breakthrough_consecutive_failures).forEach(y => {
                        (y.bonuses || []).forEach(m => {
                            if (m.type === "breakthrough_chance_add") failBonus += m.value;
                        });
                    });
                }
                if (failBonus > 0) breakdown.push({ source: "Phúc lợi thất bại", value: failBonus });

                // 7. Công Đức hộ thể (Merit)
                const meritScaling = t.BREAKTHROUGH_MERIT_SCALING;
                const karmaOffsetRate = t.MERIT_KARMA_OFFSET_RATE?.value || 0;
                let effectiveMerit = e.merit || 0;
                if (e.karma > 0 && karmaOffsetRate > 0) {
                    const neededMerit = Math.ceil(e.karma / karmaOffsetRate);
                    const meritSpent = Math.min(e.merit || 0, neededMerit);
                    effectiveMerit = (e.merit || 0) - meritSpent;
                }
                if (meritScaling && effectiveMerit > 0) {
                    const mBonus = effectiveMerit * (meritScaling.bonus_per_point || 0);
                    if (mBonus > 0) breakdown.push({ source: "Công Đức hộ thể", value: mBonus });
                }

                // 8. Sự kiện
                let eventBonus = 0;
                a.forEach(ev => {
                    (ev.bonuses || []).forEach(y => {
                        if (y.type === "breakthrough_chance_add" || y.type === "breakthrough_add") eventBonus += y.value;
                    });
                });
                if (eventBonus > 0) breakdown.push({ source: "Sự kiện", value: eventBonus });

                // 9. Đan dược
                let pillBonus = 0;
                (e.active_buffs || []).forEach(p_buff => {
                    if (p_buff.type === "breakthrough_chance_add_buff" || p_buff.type === "breakthrough_chance_add") pillBonus += p_buff.value;
                });
                if (pillBonus > 0) breakdown.push({ source: "Đan dược", value: pillBonus });

                return breakdown;
            };

            const Qc_local = (eq, t) => {
                if (!eq.is_upgradable || !eq.upgrade_level || eq.upgrade_level === 0) return eq.bonuses || [];
                const upgradeData = t.EQUIPMENT_UPGRADES.find(n => n.upgrade_level === eq.upgrade_level);
                const mult = upgradeData?.stat_multiplier || 1;
                if (mult === 1) return eq.bonuses || [];
                return (eq.bonuses || []).map(n => {
                    const b = { ...n };
                    if (n.type.endsWith("_add")) b.value = n.value * mult;
                    else if (n.type.endsWith("_mul")) b.value = (n.value - 1) * mult + 1;
                    return b;
                });
            };

            const pf_local = lv => {
                if (!lv || lv <= 1) return { qiBonus: 0, breakthroughBonus: 0 };
                const t = lv - 1;
                return { qiBonus: t * 0.01, breakthroughBonus: t * 0.002 };
            };

            // Calculate Speed Multiplier (Qi Multiplier)
            let qiMultiplier = 1;
            const rootSpeed = (gameData.SPIRITUAL_ROOTS || []).find(r => r.id === player.spiritualRoot);
            rootSpeed?.bonus?.forEach(b => { if (b.type === 'qi_per_second_multiplier') qiMultiplier += (b.value - 1); });
            const techSpeed = (gameData.TECHNIQUES || []).find(t => t.id === player.activeTechniqueId);
            techSpeed?.bonuses?.forEach(b => { if (b.type === 'qi_per_second_multiplier') qiMultiplier += (b.value - 1); });
            (player.equipment || []).forEach(eq => {
                Qc_local(eq, gameData).forEach(b => { if (b.type === 'qi_per_second_multiplier') qiMultiplier += (b.value - 1); });
            });

            const breakthroughBreakdown = calcBreakthroughBreakdown(player, gameData, activeEvents);
            const baseChance = currentRealm.breakthroughChance || 0;
            const bonusChanceTotal = breakthroughBreakdown.reduce((s, b) => s + b.value, 0);
            const totalChancePercent = (baseChance + bonusChanceTotal) * 100;
            const totalQiSpeed = currentRealm.baseQiPerSecond * qiMultiplier;

            // --- VẼ DASHBOARD ---
            console.clear();
            const timeStr = new Date().toLocaleTimeString();
            const line = C.cyan + "━".repeat(60) + C.res;

            console.log(C.cyan + "┏" + "━".repeat(58) + "┓" + C.res);
            console.log(C.cyan + "┃" + C.res + C.bri + "            CHÂN GIỚI MAIN BOT - PREMIUM VERSION        " + C.res + C.cyan + "┃" + C.res);
            console.log(C.cyan + "┗" + "━".repeat(58) + "┛" + C.res);

            // Row 1: Player Info
            console.log(` Đạo hữu: ${C.mag}${playerName}${C.res} | ${C.yel}${currentRealm.name}${C.res} | Thân thể: ${C.blu}Cấp ${player.bodyStrength || 0}${C.res} | LC: ${C.red}${formatNum(player.combat_power)}${C.res}`);

            // Qi Progress Bar
            const percent = Math.min(100, Math.floor((player.qi / currentRealm.qiThreshold) * 100));
            const barWidth = 30;
            const filledWidth = Math.floor(percent / (100 / barWidth));
            const bar = C.gre + "█".repeat(filledWidth) + C.res + C.dim + "░".repeat(barWidth - filledWidth) + C.res;
            console.log(` Linh khí: [${bar}] ${C.gre}${percent}%${C.res} (${formatNum(player.qi)} / ${formatNum(currentRealm.qiThreshold)})`);

            // Stats Row
            const bonusQi = totalQiSpeed - currentRealm.baseQiPerSecond;
            console.log(` Tốc độ: ${C.gre}${formatNum(totalQiSpeed)}/s${C.res} (${C.dim}+${formatNum(bonusQi)}${C.res}) | Thể lực: ${C.bri}${bodyPower}${C.res} | Linh thạch: ${C.yel}${formatNum(stones)}${C.res}`);
            console.log(` Công đức: ${C.mag}${formatNum(player.merit)}${C.res} | Tỷ lệ Đột phá: ${totalChancePercent > 0 ? C.gre : C.red}${totalChancePercent.toFixed(2)}%${C.res} (Cơ bản: ${baseChance * 100}%) | Tháp: ${C.cyan}Tầng ${player.tower_floor || 0}${C.res}`);

            // Chi tiết Đột phá (Dạng rút gọn)
            if (breakthroughBreakdown.length > 0) {
                const breakdownStr = breakthroughBreakdown.map(b => `${C.dim}${b.source.split(' ')[0]}:${C.res}${C.gre}+${(b.value * 100).toFixed(1)}%${C.res}`).join(' | ');
                console.log(` Breakdown: ${breakdownStr}`);
            }

            // Tiến độ Rank tiếp theo
            const nextRealm = gameData.REALMS[player.realmIndex + 1];
            if (nextRealm) {
                const qiPct = Math.min(100, (player.qi / currentRealm.qiThreshold) * 100).toFixed(1);
                console.log(` Tiến độ Rank: ${C.bri}${currentRealm.name}${C.res} ➔ ${C.yel}${nextRealm.name}${C.res} (${qiPct}%)`);
            }

            console.log(line);

            // Row: Trials
            console.log(C.bri + " [ THÍ LUYỆN ]" + C.res);
            const zones = (gameData.TRIAL_ZONES || []).sort((a, b) => b.requiredRealmIndex - a.requiredRealmIndex);
            const highestZone = zones.find(z => player.realmIndex >= z.requiredRealmIndex);

            let trialOutputs = [];
            for (const zone of zones) {
                if (player.realmIndex < zone.requiredRealmIndex) continue;
                const lastTime = lastChallenges[zone.id] || 0;
                const cooldownMs = (zone.cooldownSeconds || 300) * 1000 + 5000;
                const cd = Math.max(0, Math.floor((lastTime + cooldownMs - Date.now()) / 1000));

                if (cd <= 0) {
                    trialOutputs.push(`${C.blu}✔ ${zone.name.padEnd(16)}${C.res}`);
                    // Automation
                    apiRequest("/api/challenge", "POST", { zoneId: zone.id }, token, playerName)
                        .then(() => addLog(`Thí luyện thành công: ${zone.name}`, 'success'))
                        .catch(e => addLog(`Lỗi thí luyện ${zone.name}: ${e.message}`, 'error'));
                } else {
                    trialOutputs.push(`${C.dim}⌛ ${zone.name.padEnd(16)} (${cd}s)${C.res}`);
                }
            }
            for (let i = 0; i < trialOutputs.length; i += 2) {
                console.log(`   ${trialOutputs[i] || ""}${trialOutputs[i + 1] ? "  |  " + trialOutputs[i + 1] : ""}`);
            }

            console.log(line);

            // Row: Exploration
            console.log(C.bri + " [ THÁM HIỂM ]" + C.res);
            const explorLocs = gameData.EXPLORATION_LOCATIONS || [];
            const currentExplor = data.explorationStatus || {};

            if (currentExplor && currentExplor.locationId) {
                const loc = explorLocs.find(l => l.id === currentExplor.locationId);
                const explorCd = Math.max(0, Math.floor((currentExplor.endTime - Date.now()) / 1000));
                console.log(`   Địa điểm: ${C.yel}${loc ? loc.name : currentExplor.locationId}${C.res} | Kết thúc sau: ${C.gre}${explorCd}s${C.res}`);
            } else {
                const highestExplor = explorLocs
                    .filter(l => player.realmIndex >= l.requiredRealmIndex && player.bodyStrength >= (l.requiredBodyStrength || 0))
                    .sort((a, b) => b.requiredRealmIndex - a.requiredRealmIndex)[0];

                console.log(`   Trạng thái: ${C.dim}Sẵn sàng${C.res} | Map đề xuất: ${C.yel}${highestExplor ? highestExplor.name : "N/A"}${C.res}`);

                // Automation: Bắt đầu thám hiểm (ĐÃ TẮT CHO AC CHÍNH)

                // if (highestExplor && !currentExplor?.locationId) {
                //     addLog(`Bắt đầu thám hiểm: ${highestExplor.name}`, 'info');
                //     apiRequest("/api/start-exploration", "POST", { locationId: highestExplor.id }, token, playerName)
                //         .then(() => addLog(`Khởi hành thám hiểm ${highestExplor.name} thành công`, 'success'))
                //         .catch(e => addLog(`Lỗi khởi hành thám hiểm: ${e.message}`, 'error'));
                // }

            }

            console.log(line);

            // Row: Tower
            console.log(C.bri + " [ THÔNG THIÊN THÁP ]" + C.res);
            const towerCd = Math.max(0, Math.floor((lastTowerTime + 10000 - Date.now()) / 1000));
            if (towerCd > 0) {
                console.log(`   Tầng: ${C.cyan}${player.tower_floor || 0}${C.res} | Trạng thái: ${C.dim}Chờ hồi tháp (${towerCd}s)${C.res}`);
            } else {
                console.log(`   Tầng: ${C.cyan}${player.tower_floor || 0}${C.res} | Trạng thái: ${bodyPower >= 10 ? C.gre + "Sẵn sàng (Thể lực > 10)" : C.dim + "Chờ hồi thể lực (" + bodyPower + "/10)"}${C.res}`);
            }

            console.log(line);

            // Row: Guess Number (Optimized)
            console.log(C.bri + " [ ĐOÁN MỆNH SỐ ]" + C.res);
            const guessCd = Math.max(0, Math.floor((lastGuessTime + 301000 - Date.now()) / 1000));
            const rangeWidth = guessHigh - guessLow;
            if (lastSyncedWinner) {
                console.log(`   Trạng thái: ${C.yel}Đã kết thúc (Thắng: ${lastSyncedWinner})${C.res}`);
                console.log(`   ${C.dim}Đang chờ ván mới...${C.res}`);
            } else {
                console.log(`   Phạm vi: ${C.yel}[${guessLow} - ${guessHigh}]${C.res} | Tiếp theo: ${C.bri}${currentGuess}${C.res}`);
                const isFinalStage = (guessHigh - guessLow) <= 1;
                if (stones <= 500 && !isFinalStage) {
                    console.log(`   Trạng thái: ${C.yel}Chờ 2 số cuối (Linh Thạch < 500)${C.res}`);
                } else if (rangeWidth < 100 && rangeWidth > 2 && playerCount > 2) {
                    console.log(`   Trạng thái: ${C.mag}Chờ đồng đội thu hẹp phạm vi...${C.res}`);
                } else if (guessCd <= 0) {
                    console.log(`   Trạng thái: ${C.gre}Sẵn sàng${C.res}`);
                } else {
                    console.log(`   Trạng thái: ${C.dim}Chờ ${guessCd}s${C.res}`);
                }
            }

            console.log(line);

            // Row: Action Logs
            console.log(C.bri + " [ NHẬT KÝ HÀNH ĐỘNG ]" + C.res);
            actionLogs.slice(0, 5).forEach(log => {
                if (log.includes('✔')) console.log(`   ${C.gre}${log}${C.res}`);
                else if (log.includes('⚠')) console.log(`   ${C.yel}${log}${C.res}`);
                else if (log.includes('✘')) console.log(`   ${C.red}${log}${C.res}`);
                else console.log(`   ${C.dim}${log}${C.res}`);
            });

            console.log(C.dim + " " + "━".repeat(60) + C.res);
            console.log(` Hệ thống: ${C.gre}ONLINE${C.res} | ${timeStr} | Chờ 3s...`);

            // --- AUTOMATION LOGIC ---

            // 1. Phân bổ tiềm năng
            if (player.potential_points > 0) {
                await apiRequest("/potential/distribute", "POST", { distribution: { hp: 0, atk: player.potential_points, def: 0 } }, token, playerName)
                    .then(() => addLog(`Đã phân bổ ${player.potential_points} tiềm năng vào ATK`, 'success'))
                    .catch(() => { });
            }

            // 1b. Chuyển đổi công pháp chiến thuật (Động theo yêu cầu)
            const qiProgress = (player.qi / currentRealm.qiThreshold) * 100;
            let targetTechId = "";
            let techCriteria = "";

            const availableTechs = (gameData.TECHNIQUES || []).filter(t => player.realmIndex >= t.requiredRealmIndex);

            if (qiProgress < 95) {
                // Ưu tiên Tốc độ tu luyện lớn nhất
                techCriteria = "Tốc độ tu luyện tối đa";
                targetTechId = availableTechs.sort((a, b) => {
                    const getVal = tech => tech.bonuses.find(bn => bn.type === 'qi_per_second_multiplier')?.value || 0;
                    return getVal(b) - getVal(a);
                })[0]?.id;
            } else {
                // Ưu tiên Tỉ lệ đột phá cao nhất
                techCriteria = "Tỷ lệ đột phá tối đa";
                targetTechId = availableTechs.sort((a, b) => {
                    const getVal = tech => tech.bonuses.find(bn => bn.type === 'breakthrough_chance_add')?.value || 0;
                    return getVal(b) - getVal(a);
                })[0]?.id;
            }

            let techJustSwitched = false;

            if (targetTechId && player.activeTechniqueId !== targetTechId) {
                const switchCooldown = (gameData.TECHNIQUE_SWITCH_COOLDOWN_SECONDS || { value: 60 }).value;
                const lastSwitch = new Date(player.last_technique_switch_time || 0).getTime();
                const canSwitch = (Date.now() - lastSwitch) / 1000 > switchCooldown;

                if (canSwitch) {
                    try {
                        await apiRequest("/api/activate-technique", "POST", { techniqueId: targetTechId }, token, playerName);
                        const techName = availableTechs.find(t => t.id === targetTechId)?.name || targetTechId;
                        addLog(`Đã chuyển sang [${techName}] (${techCriteria})`, 'success');
                        player.activeTechniqueId = targetTechId;
                        techJustSwitched = true;
                    } catch (e) {
                        addLog(`Lỗi chuyển công pháp: ${e.message}`, 'error');
                    }
                }
            }

            // 3. Đột phá
            if (player.qi >= currentRealm.qiThreshold && totalChancePercent > 0) {
                await apiRequest("/api/breakthrough", "POST", null, token, playerName)
                    .then(res => {
                        if (res.success) addLog(`Đột phá thành công lên tầng mới!`, 'success');
                        else addLog(`Đột phá thất bại!`, 'warn');
                    })
                    .catch(e => addLog(`Lỗi đột phá: ${e.message}`, 'error'));
            }

            // 4. Khai mỏ (Đã tắt)
            mineStatus = "Đã tắt";


            // 5. Rèn thể (Chỉ rèn khi cần thiết)
            if (!techJustSwitched && qiProgress >= 95 && totalChancePercent <= 0 && player.exp >= 10) {
                await apiRequest("/api/temper-body", "POST", null, token, playerName)
                    .then(() => addLog(`Đã thực hiện rèn thể (Tiến độ: ${qiProgress.toFixed(1)}% | Tỷ lệ: ${totalChancePercent.toFixed(1)}%)`, 'info'))
                    .catch(() => { });
            }

            // 5b. Khiêu chiến Thông Thiên Tháp
            if (bodyPower >= 50 && (Date.now() - lastTowerTime > 10000)) {
                lastTowerTime = Date.now();
                await apiRequest("/api/tower/challenge", "POST", null, token, playerName)
                    .then(res => {
                        if (res.success) addLog(`Khiêu chiến tháp thành công! (Tầng ${(player.tower_floor || 0) + 1})`, 'success');
                        else addLog(`Khiêu chiến tháp: ${res.message || 'Thất bại'}`, 'warn');
                    })
                    .catch(e => {
                        if (!e.message.includes("400")) addLog(`Lỗi khiêu chiến tháp: ${e.message}`, 'error');
                    });
            }

            // 6. Đoán số (Binary Search with Smart Catch-up)
            const syncInterval = lastSyncedWinner ? 120000 : 3000;
            if (Date.now() - lastSyncTime > syncInterval) {
                try {
                    const gameState = await apiRequest("/api/doanso/game-state", "GET", null, token);
                    if (gameState.winner) {
                        lastSyncedWinner = gameState.winner;
                    } else if (gameState.isActive === false) {
                        lastSyncedWinner = "Hệ thống (Đang chờ)";
                    } else {
                        if (lastSyncedWinner) {
                            addLog(`Khởi động ván mới!`, 'info');
                            lastSyncedWinner = "";
                        }
                        let tempLow = 1, tempHigh = 10000;
                        (gameState.guesses || []).forEach(g => {
                            const num = g.guessNumber;
                            const hint = g.hintMessage || "";
                            if (hint.includes("lớn hơn")) { if (num <= tempHigh) tempHigh = num - 1; }
                            else if (hint.includes("nhỏ hơn")) { if (num >= tempLow) tempLow = num + 1; }
                        });
                        if (tempLow !== guessLow || tempHigh !== guessHigh) {
                            guessLow = tempLow;
                            guessHigh = tempHigh;
                            currentGuess = Math.floor((guessLow + guessHigh) / 2);
                        }
                        playerCount = new Set((gameState.guesses || []).map(g => g.playerName)).size;
                        const myLastGuess = [...(gameState.guesses || [])].reverse().find(g => g.playerName === playerName);
                        if (myLastGuess && myLastGuess.time) {
                            const remoteLastTime = new Date(myLastGuess.time).getTime();
                            if (remoteLastTime > lastGuessTime) lastGuessTime = remoteLastTime;
                        }
                    }
                    lastSyncTime = Date.now();
                } catch (e) { }
            }

            const isFinalStage = rangeWidth <= 1;
            const canGuess = stones > 500 || (isFinalStage && stones > 0);

            if (canGuess) {
                const isStrategicWait = rangeWidth < 100 && rangeWidth > 2 && playerCount > 2;

                // Main account waits 10s longer (315s total) to let clones go first
                if (!lastSyncedWinner && !isStrategicWait && (Date.now() - lastGuessTime > 315000)) {

                    // --- SYNC CHECK BEFORE GUESS ---
                    try {
                        if (fs.existsSync(GUESS_SYNC_FILE)) {
                            const syncData = JSON.parse(fs.readFileSync(GUESS_SYNC_FILE, 'utf8'));
                            // Nếu có clone vừa mới đoán (< 15s trước), hãy đồng bộ API để lấy hint mới nhất
                            if (syncData.globalLastGuessTime && (Date.now() - syncData.globalLastGuessTime < 15000) && syncData.globalLastPlayer !== playerName) {
                                addLog(`Phát hiện clone vừa đoán, đang đồng bộ API để lấy hint mới...`, 'info');
                                const gameState = await apiRequest("/api/doanso/game-state", "GET", null, token);
                                let tempLow = 1, tempHigh = 10000;
                                (gameState.guesses || []).forEach(g => {
                                    const num = g.guessNumber;
                                    const hint = g.hintMessage || "";
                                    if (hint.includes("lớn hơn")) { if (num <= tempHigh) tempHigh = num - 1; }
                                    else if (hint.includes("nhỏ hơn")) { if (num >= tempLow) tempLow = num + 1; }
                                });
                                if (tempLow !== guessLow || tempHigh !== guessHigh) {
                                    guessLow = tempLow;
                                    guessHigh = tempHigh;
                                    currentGuess = Math.floor((guessLow + guessHigh) / 2);
                                }
                            }
                        }
                    } catch (e) { }

                    // --- SYNC GUESS NUMBER ---
                    let finalGuess = currentGuess;
                    try {
                        let syncData = {};
                        if (fs.existsSync(GUESS_SYNC_FILE)) syncData = JSON.parse(fs.readFileSync(GUESS_SYNC_FILE, 'utf8'));

                        // Nếu số định đoán vẫn trùng với số "global" vừa đoán trong 60s
                        if (syncData.globalLastGuess === finalGuess && (Date.now() - syncData.globalLastGuessTime < 60000)) {
                            finalGuess = finalGuess + 1;
                            if (finalGuess > guessHigh) finalGuess = currentGuess - 1;
                            addLog(`Vẫn trùng số ${currentGuess}, đổi sang ${finalGuess}`, 'warn');
                        }

                        // Cập nhật thông tin của mình và global
                        syncData[playerName] = { lastGuessTime: Date.now(), lastGuess: finalGuess };
                        syncData.globalLastGuess = finalGuess;
                        syncData.globalLastGuessTime = Date.now();
                        syncData.globalLastPlayer = playerName;
                        fs.writeFileSync(GUESS_SYNC_FILE, JSON.stringify(syncData, null, 2));
                    } catch (e) { addLog(`Lỗi sync file: ${e.message}`, 'error'); }

                    await apiRequest("/api/doanso/guess", "POST", { guessNumber: finalGuess }, token, playerName)
                        .then(res => {
                            const hint = res.hintMessage || "";
                            addLog(`Đoán ${currentGuess}: ${hint}`, 'info');
                            if (hint.includes("lớn hơn")) { guessLow = currentGuess + 1; }
                            else if (hint.includes("nhỏ hơn")) { guessHigh = currentGuess - 1; }
                            else if (res.success || res.winner || hint.includes("CHÚC MỪNG")) {
                                addLog(`🎉 Trúng số: ${currentGuess}!`, 'success');
                                lastSyncedWinner = playerName;
                                guessLow = 1; guessHigh = 10000;
                            }
                            currentGuess = Math.floor((guessLow + guessHigh) / 2);
                            lastGuessTime = Date.now();
                        })
                        .catch(e => {
                            const err = e.message.toLowerCase();
                            if (err.includes("kết thúc") || err.includes("isactive")) {
                                lastGuessTime = Date.now() - 240000;
                            } else if (err.includes("đợi") || err.includes("phút") || err.includes("chưa tới giờ") || err.includes("wait")) {
                                lastGuessTime = Date.now();
                            } else {
                                addLog(`Lỗi đoán số: ${e.message}`, 'error');
                                lastGuessTime = Date.now();
                            }
                        });
                }
            }

        } catch (err) {
            if (err.message.includes("401")) {
                addLog("Token hết hạn, đang đăng nhập lại...", 'warn');
                token = null;
            } else {
                addLog(`Lỗi hệ thống: ${err.message}`, 'error');
            }
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

runBot().catch(e => {
    console.error(e);
    setTimeout(runBot, 3000);
});
