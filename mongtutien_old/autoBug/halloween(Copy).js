import { WebSocket } from "ws";
import { loginGetCookies } from "../login.js";
import { yellowBold, redBold, greenBold, sendEncrypted, logWithTime } from "../utils.js";

const cookieCache = {};
const keysCache = {};

let pingInterval = null;
let isReconnecting = false;   // ❗ CHỐNG LOGIN LIÊN TỤC
let loopTimer = null;         // ❗ GIỮ 1 LOOP DUY NHẤT
let currentSpiritStone = 0;

function clearAll() {
    if (pingInterval) clearInterval(pingInterval);
    if (loopTimer) clearTimeout(loopTimer);

    pingInterval = null;
    loopTimer = null;
}

async function connectSocket(props) {
    const { email, password } = props;

    if (isReconnecting) return;
    isReconnecting = true;

    const data = await loginGetCookies(email, password).catch(() => null);
    if (!data) {
        console.log(redBold("❌ Không lấy được cookie → STOP"));
        isReconnecting = false;
        return;
    }

    cookieCache[email] = data.cookies;
    const user = data.user || {};

    console.log("\n" + yellowBold(`=== [KẾT NỐI TỚI WEBSOCKET] ===`));

    let socket = new WebSocket("ws://103.149.252.61:3000/ws", {
        headers: {
            cookie: cookieCache[email],
        },
    });

    let sendCount = 0;
    let lastMessage = Date.now();

    const watchdog = setInterval(() => {
        if (Date.now() - lastMessage > 30000) {
            console.log(redBold("❌ 30s không có message → Reconnect"));
            socket.close();
        }
    }, 5000);

    const startEventLoop = (key) => {
        if (loopTimer) return; // ❗ Không tạo loop mới nếu loop cũ còn

        const loop = () => {

            if (!socket || socket.readyState !== 1) return;

            // === NGHỈ MỖI 50 LẦN ===
            if (sendCount > 0 && sendCount % 30 === 0) {
                console.log(yellowBold("⏳ Đã gửi 20 lần → nghỉ 8 giây..."));
                sendCount = 0;
                loopTimer = setTimeout(loop, 8000);
                return;
            }

            // USE PUMPKIN
            sendEncrypted({
                socket,
                obj: {
                    type: "event:use_halloween_pumpkin",
                    payload: {
                        quantity: 10,
                        itemId: "6905e2b1594b2fbf15061768",
                        originId: "halloween_pumpkin"
                    }
                },
                key
            });

            setTimeout(() => {
                if (currentSpiritStone > 50_000_000) {
                    sendEncrypted({
                        socket,
                        obj: { type: "buyKyTranCac", payload: { packageId: "26" } },
                        key
                    });
                    sendCount++;
                    loopTimer = setTimeout(loop, 800);

                } else {
                    loop()
                    console.log(yellowBold(`⛔ Không BUY (SpiritStone = ${currentSpiritStone})`));
                }
            }, 800);
        };

        loop();
    };

    socket.on("open", () => {
        console.log(greenBold("✅ Kết nối WebSocket thành công"));
        isReconnecting = false;

        if (pingInterval) clearInterval(pingInterval);
        pingInterval = setInterval(() => {
            socket.send(JSON.stringify({ type: "ping" }));
        }, 10000);
    });

    socket.on("message", (msg) => {

        try {
            lastMessage = Date.now();
            const data = JSON.parse(msg.toString());

            switch (data.type) {

                case "sessionKey": {
                    const key = {
                        aesKey: Buffer.from(data.payload.aesKey, "base64"),
                        hmacKey: Buffer.from(data.payload.hmacKey, "base64"),
                        staticIv: Buffer.from(data.payload.iv, "base64"),
                    };

                    keysCache[email] = key;

                    sendCount = 0;
                    clearTimeout(loopTimer);
                    loopTimer = null;

                    startEventLoop(key);
                    break;
                }

                case "state":
                    currentSpiritStone = Number(data.payload.spiritStone || 0);
                    break;

                case "system":
                    logWithTime(greenBold(`[${user.name}] ${data.payload.text}`));
                    break;

                case "warn":
                    console.log(yellowBold(`[${user.name}] ${data?.payload?.text}`));
                    break;
            }
        } catch (e) {
            console.error("❌ Lỗi parse message:", e);
        }
    });

    socket.on("close", () => {
        console.log(redBold("⚠️ Socket closed → reconnecting..."));

        clearAll();
        clearInterval(watchdog);

        // reconnect sau 2s để tránh spam login
        setTimeout(() => {
            isReconnecting = false;
            connectSocket(props);
        }, 2000);
    });

    socket.on("error", (err) => {
        console.log(redBold("⚠️ Socket error:"), err);
    });
}

// START
connectSocket({
    email: "",
    password: ""
});
