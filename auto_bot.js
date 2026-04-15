import fs from 'fs';
import crypto from 'crypto';

/** 
 * CÀI ĐẶT THÔNG SỐ TẠI ĐÂY 
 */
const BASE_URL = 'https://tuchangioi.online';
const SECRET_KEY = "h0yvgF4WvRSgr+1yvkYea446EX8DMs40+pt0RnWO1Jk=";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CONFIG_PATH = './config/data.json';
const TOKEN_FILE = './config/token.text';
const TARGET_MINE_ID = 5;

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
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
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
        const action = endpoint.replace("/api", "");
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
    let token = null, playerName = "", lastGuessTime = 0, lastMineCheck = 0, lastHarvestTime = 0, lastSyncTime = 0, mineStatus = "Đang kiểm tra...";
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

    addLog("Bắt đầu chu kỳ tu luyện Chân Giới...", 'success');

    while (true) {
        try {
            const [data, gameData] = await Promise.all([
                apiRequest("/api/load", "GET", null, token),
                apiRequest("/api/game-data", "GET")
            ]);

            const player = data.player;
            const currentRealm = gameData.REALMS[player.realmIndex];
            const stones = Number(player.linh_thach || 0);
            const bodyPower = player.body_power || 0;
            const lastChallenges = data.lastChallengeTime || {};

            // Tính toán tỷ lệ đột phá và tốc độ tu luyện thực tế
            let bonusChance = 0;
            let qiMultiplier = 1;

            const root = (gameData.SPIRITUAL_ROOTS || []).find(r => r.id === player.spiritualRoot);
            if (root && root.bonus) {
                root.bonus.forEach(b => {
                    if (b.type === 'breakthrough_chance_add') bonusChance += b.value;
                    if (b.type === 'qi_per_second_multiplier') qiMultiplier += (b.value - 1);
                });
            }

            const tech = (gameData.TECHNIQUES || []).find(t => t.id === player.activeTechniqueId);
            if (tech && tech.bonuses) {
                tech.bonuses.forEach(b => {
                    if (b.type === 'breakthrough_chance_add') bonusChance += b.value;
                    if (b.type === 'qi_per_second_multiplier') qiMultiplier += (b.value - 1);
                });
            }

            (player.equipment || []).forEach(eq => {
                (eq.bonuses || []).forEach(b => {
                    if (b.type === 'breakthrough_chance_add') bonusChance += b.value;
                });
            });

            const totalChance = (currentRealm.breakthroughChance + bonusChance) * 100;
            const totalQiSpeed = currentRealm.baseQiPerSecond * qiMultiplier;

            // --- VẼ DASHBOARD ---
            console.clear();
            const timeStr = new Date().toLocaleTimeString();
            const line = C.cyan + "━".repeat(60) + C.res;

            console.log(C.cyan + "┏" + "━".repeat(58) + "┓" + C.res);
            console.log(C.cyan + "┃" + C.res + C.bri + "            CHÂN GIỚI AUTO ULTIMATE - BETA V2           " + C.res + C.cyan + "┃" + C.res);
            console.log(C.cyan + "┗" + "━".repeat(58) + "┛" + C.res);

            // Row 1: Player Info
            console.log(` Đạo hữu: ${C.mag}${playerName}${C.res} | ${C.yel}${currentRealm.name}${C.res} | LC: ${C.red}${formatNum(player.combat_power)}${C.res}`);

            // Qi Progress Bar
            const percent = Math.min(100, Math.floor((player.qi / currentRealm.qiThreshold) * 100));
            const barWidth = 30;
            const filledWidth = Math.floor(percent / (100 / barWidth));
            const bar = C.gre + "█".repeat(filledWidth) + C.res + C.dim + "░".repeat(barWidth - filledWidth) + C.res;
            console.log(` Linh khí: [${bar}] ${C.gre}${percent}%${C.res} (${formatNum(player.qi)} / ${formatNum(currentRealm.qiThreshold)})`);

            // Stats Row
            console.log(` Tốc độ: ${C.gre}${formatNum(totalQiSpeed)}/s${C.res} | Thể lực: ${C.bri}${bodyPower}${C.res} | Linh thạch: ${C.yel}${formatNum(stones)}${C.res}`);
            console.log(` Công đức: ${C.mag}${formatNum(player.merit)}${C.res} | Tỷ lệ Đột phá: ${totalChance > 0 ? C.gre : C.red}${totalChance.toFixed(1)}%${C.res}`);

            console.log(line);

            // Row: Trials
            console.log(C.bri + " [ THÍ LUYỆN ]" + C.res);
            const zones = (gameData.TRIAL_ZONES || []).sort((a, b) => b.requiredRealmIndex - a.requiredRealmIndex);
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

            // Row: Mining
            console.log(C.bri + " [ KHAI MỎ ]" + C.res);
            console.log(`   Vị trí: ${C.cyan}${mineStatus}${C.res}`);

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
                if (stones <= 500) {
                    console.log(`   Trạng thái: ${C.red}Cần > 500 Linh Thạch để cược${C.res}`);
                } else if (rangeWidth < 100 && rangeWidth > 2 && playerCount > 1) {
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

            // 3. Đột phá
            if (player.qi >= currentRealm.qiThreshold && totalChance > 0) {
                await apiRequest("/api/breakthrough", "POST", null, token, playerName)
                    .then(res => {
                        if (res.success) addLog(`Đột phá thành công lên tầng mới!`, 'success');
                        else addLog(`Đột phá thất bại!`, 'warn');
                    })
                    .catch(e => addLog(`Lỗi đột phá: ${e.message}`, 'error'));
            }

            // 4. Khai mỏ (Logic đã tắt theo yêu cầu)
            mineStatus = "Đã tắt";


            // 5. Rèn thể
            if (player.exp >= 10 && totalChance <= 0) {
                await apiRequest("/api/temper-body", "POST", null, token, playerName)
                    .then(() => addLog(`Đã thực hiện rèn thể (Tỷ lệ ĐP <= 0)`, 'info'))
                    .catch(() => { });
            }

            // 6. Đoán số (Binary Search with Smart Catch-up)
            // 6a. Đồng bộ trạng thái game (Luôn chạy để lấy dự đoán)
            const syncInterval = lastSyncedWinner ? 120000 : 30000;
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

            // 6b. Gửi lệnh đoán (Chỉ khi đủ Linh Thạch)
            if (stones > 500) {
                const rangeWidth = guessHigh - guessLow;
                const isStrategicWait = rangeWidth < 10 && rangeWidth > 2 && playerCount > 1;

                if (!lastSyncedWinner && !isStrategicWait && (Date.now() - lastGuessTime > 305000)) {
                    await apiRequest("/api/doanso/guess", "POST", { guessNumber: currentGuess }, token, playerName)
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
                                addLog(`Server báo chờ: Đã cập nhật lại thời gian hồi.`, 'warn');
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
        await new Promise(r => setTimeout(r, 3000));
    }
}

runBot().catch(e => {
    console.error(e);
    setTimeout(runBot, 3000);
});
