import {
    yellowBold,
    greenBold,
    redBold,
    readConfig,
    socketDomain,
    log,
    colors
} from './utils.js';
import WebSocket from 'ws';
import { login, checkSession } from './login.js';
import { cleanupOnSocketClose, messageHandler } from './messageHandler.js';

const socketCache = {};
const reconnectAttempts = {};

async function connectSocket(account) {
    const { email, password } = account;
    log(`[${email}] 🔍 Đang kiểm tra trạng thái phiên làm việc...`, colors.dim);
    let session = account.session;

    // Check if session is still valid
    if (session) {
        const isValid = await checkSession(session);
        if (!isValid) {
            log(`Session cũ hết hạn cho ${email}, đang đăng nhập lại...`, colors.red);
            session = await login(email, password);
        }
    } else {
        session = await login(email, password);
    }

    if (!session) {
        log(`❌ Không thể đăng nhập cho ${email}, bỏ qua.`, colors.red);
        return;
    }

    const user = session.character;
    if (!user) {
        log(`❌ Không tìm thấy thông tin nhân vật cho ${email}.`, colors.red);
        return;
    }

    log(`\n` + yellowBold(`=== [KẾT NỐI TỚI WEBSOCKET: ${user.name}] ===`));

    const socket = new WebSocket(socketDomain, {
        headers: {
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9,vi;q=0.8",
            "Cache-Control": "no-cache",
            "Connection": "Upgrade",
            "Cookie": session.cookies,
            "Host": "mongtutien.me",
            "Origin": "https://mongtutien.me",
            "Pragma": "no-cache",
            "Upgrade": "websocket",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });

    socketCache[email] = socket;

    socket.on("open", () => {
        reconnectAttempts[email] = 0;
        log(greenBold(`✅ Kết nối WebSocket thành công cho ${user.name}`));
    });

    socket.on("message", (message) => {
        try {
            const frame = JSON.parse(message.toString());
            // log(`[${user.name}] 📥 Received frame: op=${frame.op}, t=${frame.t}`, colors.dim);
            
            // Handle protocol v2 frames
            if (frame.v === 2) {
                if (frame.op === "e") {
                    log(`[${user.name}] 📥 Event: ${frame.t}`, colors.dim);
                    messageHandler({
                        data: { type: frame.t, payload: frame.p },
                        socket,
                        user,
                        email,
                        reconnect: () => connectSocket(account),
                    });
                } else if (frame.op === "s") {
                    log(`[${user.name}] 📥 State update`, colors.dim);
                    // State update
                    messageHandler({
                        data: { type: "state", payload: frame.p },
                        socket,
                        user,
                        email,
                        reconnect: () => connectSocket(account),
                    });
                } else if (frame.op === "h") {
                    // Hello/Handshake
                    log(`[${user.name}] 👋 Server Hello: sid=${frame.sid}`, colors.dim);
                    messageHandler({
                        data: { type: "hello", payload: frame },
                        socket,
                        user,
                        email,
                        reconnect: () => connectSocket(account),
                    });
                } else if (frame.op === "n") {
                    log(`[${user.name}] 📥 Notice: ${frame.l}`, colors.dim);
                    messageHandler({
                        data: { type: "notice", payload: frame.p, level: frame.l },
                        socket,
                        user,
                        email,
                        reconnect: () => connectSocket(account),
                    });
                } else if (frame.op === "a") {
                    log(`[${user.name}] 📥 Ack: i=${frame.i}, ok=${frame.ok}`, colors.dim);
                } else if (frame.op === "po") {
                    // Pong received
                }
            } else {
                // Fallback for legacy messages if any
                messageHandler({
                    data: frame,
                    socket,
                    user,
                    email,
                    reconnect: () => connectSocket(account),
                });
            }
        } catch (err) {
            console.error(`❌ Lỗi xử lý message cho ${email}:`, err);
        }
    });

    socket.on("close", () => {
        log(`❌ Socket của ${email} bị đóng — thử kết nối lại sau 10s...`, colors.red);
        cleanupOnSocketClose(email);
        delete socketCache[email];
        
        reconnectAttempts[email] = (reconnectAttempts[email] || 0) + 1;
        if (reconnectAttempts[email] <= 5) {
            setTimeout(() => connectSocket(account), 10000);
        } else {
            log(`❌ Đăng nhập thất bại cho ${email}. Đã thử kết nối lại quá 5 lần.`, colors.red);
        }
    });

    socket.on("error", (err) => {
        log(`❌ WebSocket error cho ${email}: ${err.message}`, colors.red);
    });
}

async function startAuto() {
    const config = readConfig();
    const accounts = config.accounts || [];

    if (accounts.length === 0) {
        log("❌ Không tìm thấy tài khoản nào trong data.json", redBold);
        return;
    }

    log(greenBold(`🚀 Bắt đầu chạy auto cho ${accounts.length} tài khoản...`));

    accounts.forEach((account, index) => {
        setTimeout(() => {
            connectSocket(account);
        }, 2000 * index); // Delay between accounts to avoid rate limits
    });
}

startAuto();
