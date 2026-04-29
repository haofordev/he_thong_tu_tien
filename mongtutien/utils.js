import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const domain = "https://mongtutien.me";
export const socketDomain = "wss://mongtutien.me/ws-v2";

export const mapPrices = {
    "linh-coc": "Linh Cốc Cốc",
    "tu-tien-lam": "Tu Tiên Sâm Lâm",
    "thien-canh": "Thiên Cảnh Phong",
    "thien-son": "Thiên Sơn",
    "thien-ha": "Thiên Hạ Hải",
    "thien-gioi": "Thiên Giới Phong",
    "thien-dia": "Thiên Địa Cấm Khu",
    "than-ma-chi-dia": "Thần Ma Chi Địa",
    "hong_mong_cam_dia": "Hồng Mòng Cấm Địa",
    "vuc_sau_vo_tan": "Vô Tận Hoả Vực Sâu"
};

export const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
};

export function log(msg, color = colors.white) {
    const time = new Date().toLocaleTimeString('vi-VN', { hour12: false });
    console.log(`${colors.dim}[${time}]${colors.reset} ${color}${msg}${colors.reset}`);
}

export function yellowBold(...texts) {
    return `${colors.bright}${colors.yellow}${texts.join(" ")}${colors.reset}`;
}

export function redBold(...texts) {
    return `${colors.bright}${colors.red}${texts.join(" ")}${colors.reset}`;
}

export function greenBold(...texts) {
    return `${colors.bright}${colors.green}${texts.join(" ")}${colors.reset}`;
}

export function blueBold(...texts) {
    return `${colors.bright}${colors.blue}${texts.join(" ")}${colors.reset}`;
}

export function purpleBold(...texts) {
    return `${colors.bright}${colors.magenta}${texts.join(" ")}${colors.reset}`;
}

export function logWithTime(content) {
    log(content);
}

export function sendCommand(socket, type, payload = {}) {
    if (socket.readyState !== WebSocket.OPEN) return;
    console.log(`[OUT] ${type}`, payload);
    const frame = {
        v: 2,
        op: "c",
        t: type,
        p: payload
    };
    socket.send(JSON.stringify(frame));
}

export function sendEncrypted({ socket, obj, key, onError }) {
    // Keep as fallback or for legacy support if needed, but wrap in v2 if possible
    if (!key || !key.aesKey || !key.staticIv || !key.hmacKey) {
        // If no key, maybe send as raw? For now, just send raw as the game seems to have removed encryption
        sendCommand(socket, obj.type, obj.payload);
        return;
    }
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const messageData = JSON.stringify({ timestamp, nonce, data: obj });

    const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(key.aesKey, 'hex'), Buffer.from(key.staticIv, 'hex'));
    let ciphertext = cipher.update(messageData, "utf8", "base64");
    ciphertext += cipher.final("base64");

    const signature = crypto.createHmac("sha256", Buffer.from(key.hmacKey, 'hex'))
        .update(ciphertext + nonce + timestamp)
        .digest("hex");

    // Wrap the encrypted blob in a v2 command frame of type 'encrypted'
    sendCommand(socket, "encrypted", { ciphertext, nonce, timestamp, signature });
}

export function readConfig() {
    const configPath = path.join(__dirname, 'data.json');
    if (!fs.existsSync(configPath)) {
        return { accounts: [] };
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

export function saveSession(email, sessionData) {
    const config = readConfig();
    const index = config.accounts.findIndex(a => a.email === email);
    if (index !== -1) {
        config.accounts[index].session = sessionData;
        fs.writeFileSync(path.join(__dirname, 'data.json'), JSON.stringify(config, null, 2));
    }
}
