import { WebSocket } from "ws";
import { loginGetCookies } from "./login.js";
import { yellowBold, redBold, greenBold, sendEncrypted, logWithTime } from "./utils.js";

const cookieCache = {};
const keysCache = {};

// mỗi account có 1 trạng thái riêng
const accountState = {}; // email → { pingInterval, loopTimer, isReconnecting }

function clearAccountTimers(email) {
    const s = accountState[email];
    if (!s) return;

    if (s.pingInterval) clearInterval(s.pingInterval);
    if (s.loopTimer) clearTimeout(s.loopTimer);

    s.pingInterval = null;
    s.loopTimer = null;
}

async function connectSocket(props) {
    const { email, password } = props;

    // Khởi tạo state nếu chưa có
    if (!accountState[email]) {
        accountState[email] = {
            pingInterval: null,
            loopTimer: null,
            isReconnecting: false,
        };
    }

    const state = accountState[email];

    if (state.isReconnecting) return;
    state.isReconnecting = true;

    const data = await loginGetCookies(email, password).catch(() => null);
    if (!data) {
        console.log(redBold(`❌ [${email}] Không lấy được cookie → STOP`));
        state.isReconnecting = false;
        return;
    }

    cookieCache[email] = data.cookies;
    const user = data.user || {};

    console.log("\n" + yellowBold(`=== [${user.name}] KẾT NỐI WEBSOCKET ===`));

    let socket = new WebSocket("wss://mongtutien.online/ws", {
        headers: { cookie: cookieCache[email] }
    });

    let sendCount = 0;
    let lastMessage = Date.now();

    const watchdog = setInterval(() => {
        if (Date.now() - lastMessage > 30000) {
            console.log(redBold(`❌ [${user.name}] 30s không có message → Reconnect`));
            socket.close();
        }
    }, 5000);

    const runTasksSequentially = async (key) => {
        if (!socket || socket.readyState !== 1) return;

        const tasks = [];

        const buyItem1Times = 188
        const buyItem2Times = 125
        const buyItem3Times = 0
        const alchemyTimes = 70

        // 0 thăng cảnh đan 
        // 1 Luân hồi đan
        // 2 Thien huong dan
        // 3 Vô cực tiên đan

        const indexAlchemy = 1


        const object = {
            0: {
                "buyHerb1": "herb_moon_marrow",
                "buyHerb2": "herb_spirit_leaf",
                "refine": "pill_breakthrough_1"
            },
            1: {
                "buyHerb1": "herb_moon_marrow",
                "buyHerb2": "herb_dragon_scale_root",
                "refine": "pill_rebirth_1"
            },
            2: {
                "buyHerb1": "herb_celestial_dew",
                "buyHerb2": "herb_marrow_cleansing_grass",
                "buyHerb3": "herb_fire_leaf",
                "refine": "thienHuongDan"
            },
            3: {
                "buyHerb1": "herb仙_fruit",
                "buyHerb2": "herb_chaos_aura",
                "buyHerb3": "herb_heavenly_pattern",
                "refine": "pill_rebirth_2"
            }
        }

        // // 30 lần mua herb_moon_marrow
        for (let i = 0; i < buyItem1Times; i++) {
            tasks.push(async () => {
                await sendEncrypted({
                    socket,
                    obj: { type: 'pill:buyHerb', payload: { herbId: object[indexAlchemy].buyHerb1 } },
                    key
                });
                console.log(`✅ Mua ${object[indexAlchemy].buyHerb1} lần ${i + 1}`);
            });
        }

        // 30 lần mua herb_dragon_scale_root
        for (let i = 0; i < buyItem2Times; i++) {
            tasks.push(async () => {
                await sendEncrypted({
                    socket,
                    obj: { type: 'pill:buyHerb', payload: { herbId: object[indexAlchemy].buyHerb2 } },
                    key
                });
                console.log(`✅ Mua ${object[indexAlchemy].buyHerb2} lần ${i + 1}`);
            });
        }

        if (object[indexAlchemy].buyHerb3) {
            for (let i = 0; i < buyItem3Times; i++) {
                tasks.push(async () => {
                    await sendEncrypted({
                        socket,
                        obj: { type: 'pill:buyHerb', payload: { herbId: object[indexAlchemy].buyHerb3 } },
                        key
                    });
                    console.log(`✅ Mua ${object[indexAlchemy].buyHerb3} lần ${i + 1}`);
                });
            }
        }

        for (let i = 0; i < alchemyTimes; i++) {
            // 1 lần refine
            tasks.push(async () => {
                await sendEncrypted({
                    socket,
                    obj: { type: 'pill:refine', payload: { formulaId: object[indexAlchemy].refine, quantity: 10 } },
                    key
                });
                console.log(`✅ luyện 10 dan lan ${i + 1}`);
            });
        }


        // xử lý tuần tự từng task
        for (const task of tasks) {
            await task();
            // nghỉ 600ms giữa mỗi task
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        console.log('🎉 Hoàn tất tất cả tasks!');
    };


    // ===========================
    // 🔌 SOCKET EVENTS
    // ===========================

    socket.on("open", () => {
        console.log(greenBold(`✅ [${user.name}] WebSocket connected`));
        state.isReconnecting = false;

        if (state.pingInterval) clearInterval(state.pingInterval);
        state.pingInterval = setInterval(() => {
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
                    clearTimeout(state.loopTimer);
                    state.loopTimer = null;

                    //startEventLoop(key);
                    runTasksSequentially(key)
                    break;
                }

                case "state": {
                    const items = data.payload.items;
                    const bingo = items?.find(i => i.item?.itemId === "wife_essence");
                    if (bingo) {
                        console.log(`[${user.name}] 🎃 ${bingo.quantity.toLocaleString()}`);
                    }
                    break;
                }

                case "system":
                    logWithTime(greenBold(`[${user.name}] ${data.payload.text}`));
                    break;

                case "warn":
                    console.log(yellowBold(`[${user.name}] ${data.payload.text}`));
                    break;
            }
        } catch (e) {
            console.error(`❌ [${user.name}] Parse error:`, e);
        }
    });

    socket.on("close", () => {
        console.log(redBold(`⚠️ [${user.name}] Socket closed → reconnecting...`));

        clearAccountTimers(email);
        clearInterval(watchdog);

        setTimeout(() => {
            accountState[email].isReconnecting = false;
            connectSocket(props);
        }, 2000);
    });

    socket.on("error", (err) =>
        console.log(redBold(`⚠️ [${user.name}] Socket error:`), err)
    );
}

// ======================================
// 🚀 START MULTI ACCOUNT
// ======================================

const ACCOUNTS = [
    { email: "binhboong2k4@gmail.com", password: "mK 26012004" },
];

for (const acc of ACCOUNTS) {
    connectSocket(acc);
}
