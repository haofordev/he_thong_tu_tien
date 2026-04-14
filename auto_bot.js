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

// --- Các hàm tiện ích ---

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
    let token = null, playerName = "", lastGuessTime = 0;
    const colors = { reset: "\x1b[0m", cyan: "\x1b[36m", green: "\x1b[32m", yellow: "\x1b[33m", magenta: "\x1b[35m", red: "\x1b[31m", blue: "\x1b[34m", bright: "\x1b[1m" };

    if (fs.existsSync(TOKEN_FILE)) token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (token) {
        try { playerName = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).name; } catch (e) { token = null; }
    }
    if (!token) {
        try {
            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            const ts = Date.now();
            const loginPayload = { username: config.email, password: config.password, signature: generateLoginSignature(config.email, config.password, ts), timestamp: ts, turnstileToken: "dev-mock-token-" + Date.now() };
            const loginData = await apiRequest("/api/auth/login", "POST", loginPayload);
            token = loginData.token; playerName = loginData.playerName;
            fs.writeFileSync(TOKEN_FILE, token);
        } catch (e) { return console.log("[Login Error]", e.message); }
    }

    while (true) {
        try {
            const [data, gameData, guessState] = await Promise.all([
                apiRequest("/api/load", "GET", null, token),
                apiRequest("/api/game-data", "GET"),
                apiRequest("/api/doanso/game-state", "GET", null, token)
            ]);

            const player = data.player;
            const currentRealm = gameData.REALMS[player.realmIndex];
            const stones = Number(player.linh_thach || 0);
            const bodyPower = player.body_power || 0;
            const lastChallenges = data.lastChallengeTime || {};

            console.clear();
            const percent = Math.min(100, Math.floor((player.qi / currentRealm.qiThreshold) * 100));
            const bar = colors.green + "█".repeat(Math.floor(percent/5)) + colors.reset + "░".repeat(20 - Math.floor(percent/5));

            console.log(colors.cyan + "====================================================" + colors.reset);
            console.log(colors.cyan + "   " + colors.bright + "CHÂN GIỚI AUTO ULTIMATE" + colors.reset + ` - [${colors.yellow}${new Date().toLocaleTimeString()}${colors.cyan}]`);
            console.log(colors.cyan + "====================================================" + colors.reset);
            console.log(` Đạo hữu:   ${colors.magenta}${playerName}${colors.reset} | LC: ${colors.red}${Number(player.combat_power || 0).toLocaleString()}${colors.reset}`);
            console.log(` Cảnh giới: ${colors.yellow}${currentRealm.name}${colors.reset}`);
            console.log(` Linh khí:  [${bar}] ${colors.green}${Math.floor(player.qi)}${colors.reset}/${currentRealm.qiThreshold} (${percent}%)`);
            console.log(` Thể lực:   ${colors.bright}${bodyPower}${colors.reset} | Linh thạch: ${colors.yellow}${stones.toLocaleString()}${colors.reset}`);
            console.log(colors.cyan + "----------------------------------------------------" + colors.reset);
            
            // 1. AUTO PHÂN BỔ TIỀM NĂNG (Dồn 100% vào ATK)
            if (player.potential_points > 0) {
                await apiRequest("/potential/distribute", "POST", { distribution: { hp: 0, atk: player.potential_points, def: 0 } }, token, playerName).catch(()=>{});
            }

            // 2. AUTO THI TUYÊN TẤT CẢ CÁC VÙNG
            const zones = gameData.CHALLENGE_ZONES || [];
            let nextTrialMsg = "Đã quét sạch Thí luyện.";
            for (const zone of zones) {
                const lastTime = lastChallenges[zone.id] || 0;
                const cd = Math.max(0, Math.floor((lastTime + 305000 - Date.now()) / 1000));
                
                if (cd <= 0 && bodyPower >= 10 && player.realmIndex >= zone.minRealm) {
                    console.log(` [HÀNH ĐỘNG] Đang càn quét: ${colors.bright}${zone.name}${colors.reset}...`);
                    await apiRequest("/api/challenge", "POST", { zoneId: zone.id }, token, playerName).catch(()=>{});
                    break; // Ưu tiên đánh từng vùng một ở mỗi vòng lặp 5s
                } else if (cd > 0 && player.realmIndex >= zone.minRealm) {
                    nextTrialMsg = `Tiếp theo: ${zone.name} (${cd}s)`;
                }
            }
            console.log(` [THÍ LUYỆN] ${nextTrialMsg}`);

            // 3. AUTO ĐỘT PHÁ
            if (player.qi >= currentRealm.qiThreshold) {
                await apiRequest("/api/breakthrough", "POST", null, token, playerName).catch(()=>{});
            } else {
                console.log(` [TRẠNG THÁI] Đang tọa thiền tập trung tu luyện...`);
            }

            console.log(colors.cyan + "====================================================" + colors.reset);
        } catch (err) { if (err.message.includes("401")) break; }
        await new Promise(r => setTimeout(r, 5000));
    }
}

runBot().catch(e => setTimeout(runBot, 5000));
