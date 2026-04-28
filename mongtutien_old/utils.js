import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import crypto from "crypto";

export const domain = "https://mongtutien.me"
export const socketDomain = "wss://mongtutien.me/ws";
export const socketBossDomain = "wss://mongtutien.me/ws-boss";

export const mapPrices = {
    "linh-coc": "Linh Cốc Cốc (10,000 linh thạch)",
    "tu-tien-lam": "Tu Tiên Sâm Lâm (20,000 linh thạch)",
    "thien-canh": "Thiên Cảnh Phong (150,000 linh thạch)",
    "thien-son": "Thiên Sơn (100,000 linh thạch)",
    "thien-ha": "Thiên Hạ Hải (500,000 linh thạch)",
    "thien-gioi": "Thiên Giới Phong (900,000 linh thạch)",
    "thien-dia": "Thiên Địa Cấm Khu (500,000 linh thạch)",
    "than-ma-chi-dia": "Thần Ma Chi Địa (5,000,000 linh thạch)",
    "hong_mong_cam_dia": "Hồng Mòng Cấm Địa (10,000,000 linh thạch)",
    "vuc_sau_vo_tan": "Vô Tận Hoả Vực Sâu (20,000,000 linh thạch)",
    "cultivate": "Tu Luyện (0 linh thạch)"
}

export const mapOuterRealms = {
    rim: "Vùng Rìa (Lv ≤ 80)",
    center: "Vùng Trung Tâm (Lv 90–100)",
    core: "Vùng Trong Cùng (Lv 100+)"
}

export const mapTranslate = {
    spiritStone: "Linh thạch",
    treasure_coin: "Xu tầm bảo",
    honor: "Công đức",
    wife_essence: "Tinh hoa đạo lữ",
    towerToken: "Xu tháp",
    pet_essence: "Tinh hoa linh thú",
    gold: "Vàng",
    item_001: "Tinh Thạch",
    gift_dong_tam_ket: "Đồng Tâm Kết"
};


export const mapEncounter = {
    kyngo_beauty_danger: 1,
    kyngo_mysterious_woman: 2,
    kyngo_trapped_beast: 1,
    kyngo_grave_old_lady: 0,
    kyngo_persecuted_cultivator: 0,
    kyngo_spirit_monkey: 1,
    kyngo_strange_fish: 0,
    kyngo_dying_old_man: 1,
    kyngo_ice_cold_lady: 0,
    kyngo_puppet_girl: 0,
    kyngo_dragon_horn_girl: 0,
    kyngo_alchemy_girl: 0,
    kyngo_bandits_encounter: 1,
    kyngo_suspicious_hunt: 1,
    kyngo_two_strange_men: 1,
    kyngo_abandoned_pill_room: 0,
    kyngo_chess_old_man: 1,
    kyngo_void_duel: 1,
    kyngo_herb_garden: 0,
    kyngo_fleeing_noble_lady: 0,
    kyngo_fire_oldman: 0,
    kyngo_mysterious_merchant: 0,
    kyngo_dying_oldman: 0
};

export const replaceHTMLSystem = [
    `<span class="text-yellow-400">`,
    `<span class="text-yellow-300">`,
    `</span>`,
    `<span class="text-yellow-300 font-semibold">`,
    `<span class="text-yellow-300 font-semibold">`,
    `<b>`,
    `</b>`,
    `<span class='text-yellow-300 font-bold'>`,
    `<span class='text-purple-300 font-semibold'>`,
    `<span class='text-emerald-400 font-semibold'>`,
    `<span class='text-blue-300>`,
    `<span class='text-blue-300 font-semibold'>`,
    `<span class='text-rose-400 font-semibold'>`,
    `<span class='text-yellow-300 font-semibold'>`,
    `<span class='text-yellow-300 font-semibold'>`,
    `<span class="text-xs text-gray-400 ml-2">`,
    `<span class="text-emerald-400 text-xs italic">`,
    `<span class="text-white/70">`
]

export const timemeCheck = [300, 900, 1800, 3600, 7200, 10800, 14400, 21600]

export function lootToString(obj) {
    return Object.entries(obj)
        .map(([key, value]) => `${mapTranslate[key] || key}: ${value}`)
        .join(", ");
}

export function getRestTime(endTimeStr) {
    const endTime = new Date(endTimeStr);
    const now = new Date();

    let diffMs = endTime - now;
    if (diffMs < 0) diffMs = 0;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
    const seconds = Math.floor(diffMs / 1000) % 60;

    return { hours, minutes, seconds };
}


export function getDurationTime(start, end) {
    const diffMs = new Date(end) - new Date(start); // difference in ms

    const hh = String(Math.floor(diffMs / (1000 * 60 * 60))).padStart(2, '0');
    const mm = String(Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const ss = String(Math.floor((diffMs % (1000 * 60)) / 1000)).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
}

// Current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function yellowBold(...texts) {
    return `\x1b[1m\x1b[33m${texts.join(" ")}\x1b[0m`;
}

export function purpleBold(...texts) {
    return `\x1b[1m\x1b[35m${texts.join(" ")}\x1b[0m`;
}

export function greenBold(...texts) {
    return `\x1b[1m\x1b[32m${texts.join(" ")}\x1b[0m`;
}

export function blueBold(...texts) {
    return `\x1b[1m\x1b[34m${texts.join(" ")}\x1b[0m`;
}

export function redBold(...texts) {
    return `\x1b[1m\x1b[31m${texts.join(" ")}\x1b[0m`;
}

export function logWithTime(content) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] ${content}`);
}

export function logLineBreak(isFirst = false) {
    console.log("=======================")
}

export function readAccountsFromFile(name, type) {
    const filePath = path.join(__dirname, name);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ ${name} không tồn tại`);
        return [];
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);

    return lines.map(line => {
        const [email, password, extra] = line.split(':').map(s => s.trim());
        return { email, password, [type]: extra };
    });
}

export function readAccountsJsonFile(name) {
    const filePath = path.join(__dirname, name);

    if (!fs.existsSync(filePath)) {
        console.error(`❌ ${name} không tồn tại`);
        return [];
    }

    try {
        const data = fs.readFileSync(filePath, "utf8");
        return JSON.parse(data);
    } catch (err) {
        console.error(`❌ Lỗi khi đọc hoặc parse JSON từ ${name}:`, err.message);
        return [];
    }
}

export function isInTimeRange(startHour, startMinute, endHour, endMinute) {
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return current >= start && current <= end;
}

export function sendEncrypted({ socket, obj, key, onError }) {
    if (!key) {
        console.warn(`🔒 Encryption key not initialized yet, skipping send`);
        if (typeof onError === "function") {
            onError(new Error("Encryption key not initialized"));
        }
        return;
    }
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const messageData = JSON.stringify({ timestamp, nonce, data: obj });

    const cipher = crypto.createCipheriv("aes-256-cbc", key.aesKey, key.staticIv);
    let ciphertext = cipher.update(messageData, "utf8", "base64");
    ciphertext += cipher.final("base64");

    const signature = crypto.createHmac("sha256", key.hmacKey)
        .update(ciphertext + nonce + timestamp)
        .digest("hex");

    socket.send(JSON.stringify({ ciphertext, nonce, timestamp, signature }));
}

export function convertSecondToTime(seconds = 0) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return [
        String(h).padStart(2, '0'),
        String(m).padStart(2, '0'),
        String(s).padStart(2, '0')
    ].join(':');
}