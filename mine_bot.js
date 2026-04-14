import fs from 'fs';
import crypto from 'crypto';

/** 
 * ==========================================
 * CÀI ĐẶT THÔNG SỐ - CHÂN GIỚI MINE BOT
 * ==========================================
 */
const BASE_URL = 'https://tuchangioi.online'; 
const SECRET_KEY = "h0yvgF4WvRSgr+1yvkYea446EX8DMs40+pt0RnWO1Jk="; // Key từ auto_bot.js
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TOKEN_FILE = './config/token.text';
const TARGET_MINE_ID = 5; // Mỏ mặc định muốn chiếm

const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    white: "\x1b[37m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    bgBlue: "\x1b[44m"
};

// --- Utilities ---
function hp(payload) {
    if (!payload || Object.keys(payload).length === 0) return "";
    return Object.keys(payload).sort().map(k => `${k}${payload[k]}`).join("");
}

function generateSignature(playerName, action, payload, timestamp) {
    const dataStr = `${playerName}${action}${hp(payload)}${timestamp}${USER_AGENT}`;
    return crypto.createHmac('sha256', SECRET_KEY).update(dataStr).digest('hex');
}

async function apiRequest(endpoint, method = "GET", payload = null, token = null, playerName = null) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { 
        'User-Agent': USER_AGENT, 
        'Accept': '*/*',
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    let body = null;
    if (method === "POST") {
        const timestamp = Date.now();
        const action = endpoint.replace("/api", ""); 
        
        // Hầu hết các API POST trong game đều yêu cầu signature
        if (playerName) {
            body = JSON.stringify({
                ...(payload || {}), 
                action: action, 
                timestamp: timestamp,
                signature: generateSignature(playerName, action, payload, timestamp)
            });
        } else {
            body = JSON.stringify(payload);
        }
    }

    try {
        const res = await fetch(url, { method, headers, body });
        const data = await res.json();
        // Một số API trả về message lỗi trong JSON nhưng status vẫn 200/400
        if (!res.ok && !data.message) throw new Error(`Lỗi kết nối: ${res.status}`);
        return data;
    } catch (e) {
        throw new Error(e.message);
    }
}

function logHeader(playerName) {
    console.clear();
    console.log(colors.cyan + "╔════════════════════════════════════════════════════╗" + colors.reset);
    console.log(colors.cyan + "║" + colors.bright + colors.magenta + "          CHÂN GIỚI - TỰ ĐỘNG KHAI THÁC MỎ          " + colors.reset + colors.cyan + "║" + colors.reset);
    console.log(colors.cyan + "╠════════════════════════════════════════════════════╣" + colors.reset);
    console.log(colors.cyan + "║" + colors.white + `  Đạo hữu: ${colors.yellow}${playerName.padEnd(38)}${colors.reset}${colors.cyan}║` + colors.reset);
    console.log(colors.cyan + "║" + colors.white + `  Thời gian: ${colors.green}${new Date().toLocaleString('vi-VN').padEnd(36)}${colors.reset}${colors.cyan}║` + colors.reset);
    console.log(colors.cyan + "╚════════════════════════════════════════════════════╝" + colors.reset);
}

async function startMiningBot() {
    let token = null;
    let playerName = "Ẩn danh";

    // 1. Load Token
    if (fs.existsSync(TOKEN_FILE)) {
        token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
        try {
            const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            playerName = decoded.name;
        } catch (e) {
            console.error(colors.red + "[LỖI] Token không hợp lệ!" + colors.reset);
            return;
        }
    } else {
        console.error(colors.red + "[LỖI] Không tìm thấy file config/token.text!" + colors.reset);
        return;
    }

    while (true) {
        try {
            logHeader(playerName);
            console.log(`${colors.dim}❯ Đang quét danh sách tài nguyên...${colors.reset}`);
            
            const mines = await apiRequest("/api/mine/list", "GET", null, token);
            
            // Tìm mỏ đang chiếm
            const myMine = mines.find(m => m.isOwned === true || m.occupierName === playerName);
            
            if (myMine) {
                const timeLeft = myMine.occupationTimeLeft || 0;
                const minutesLeft = Math.floor(timeLeft / 60000);
                const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

                console.log(`${colors.blue}┌ TRẠNG THÁI HIỆN TẠI${colors.reset}`);
                console.log(`${colors.blue}│${colors.reset} Mỏ: ${colors.bright}${myMine.name}${colors.reset} (ID: ${myMine.id})`);
                console.log(`${colors.blue}│${colors.reset} Thời gian còn lại: ${colors.yellow}${minutesLeft}p ${secondsLeft}s${colors.reset}`);
                
                if (myMine.canHarvest) {
                    console.log(`${colors.blue}└${colors.reset} ${colors.bgBlue}${colors.white} TỚI GIỜ THU HOẠCH! ${colors.reset}`);
                    console.log(`${colors.yellow}❯ Đang tiến hành thu hoạch...${colors.reset}`);
                    
                    const res = await apiRequest("/api/mine/harvest", "POST", { mineId: myMine.id }, token, playerName);
                    console.log(`${colors.green}✔ ${res.message || "Đã thu hoạch thành công!"}${colors.reset}`);
                } else {
                    console.log(`${colors.blue}└${colors.reset} ${colors.dim}Chưa tới giờ thu hoạch. Vui lòng chờ đợi...${colors.reset}`);
                }
            } else {
                console.log(`${colors.red}⚠ Bạn hiện không chiếm giữ mỏ nào!${colors.reset}`);
                console.log(`${colors.yellow}❯ Đang tìm mỏ ${TARGET_MINE_ID} để chiếm giữ...${colors.reset}`);
                
                try {
                    const res = await apiRequest("/api/mine/occupy", "POST", { mineId: TARGET_MINE_ID }, token, playerName);
                    if (res.message) {
                        console.log(`${colors.green}✔ ${res.message}${colors.reset}`);
                    } else {
                        console.log(`${colors.green}✔ Chiếm mỏ thành công!${colors.reset}`);
                    }
                } catch (err) {
                    console.log(`${colors.red}✘ Không thể chiếm mỏ: ${err.message}${colors.reset}`);
                    
                    // Nếu mỏ 5 không được, thử tìm mỏ trống bất kỳ (optional)
                    const freeMine = mines.find(m => !m.isOccupied);
                    if (freeMine) {
                        console.log(`${colors.yellow}❯ Đang thử chiếm mỏ trống: ${freeMine.name} (ID: ${freeMine.id})...${colors.reset}`);
                        await apiRequest("/api/mine/occupy", "POST", { mineId: freeMine.id }, token, playerName)
                            .then(r => console.log(`${colors.green}✔ ${r.message || "Thành công!"}${colors.reset}`))
                            .catch(e => console.log(`${colors.red}✘ Vẫn thất bại: ${e.message}${colors.reset}`));
                    }
                }
            }

        } catch (error) {
            console.log(`${colors.red} [LỖI HỆ THỐNG] ${error.message}${colors.reset}`);
        }

        console.log(`\n${colors.dim}Hệ thống sẽ kiểm tra lại sau 60 giây...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 60000));
    }
}

// Chạy bot
startMiningBot().catch(e => {
    console.error("Bot crash:", e);
    setTimeout(startMiningBot, 5000);
});
