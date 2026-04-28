import { WebSocket } from "ws";
import readline from "readline";
import { loginGetCookies } from "../login.js";
import { yellowBold, redBold, greenBold, sendEncrypted, readAccountsJsonFile } from "../utils.js";
import { statLabelMap, writeJsonAtomic } from "./utils.js";

const cookieCache = {};
const keysCache = {};
let globalItem = {};
let globalData = {};

const DATA_PATH = "./tayTrangBi/data.json"
function getValueByPath(obj, path) {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function getKeysWithValueOne(obj, prefix = '') {
    let keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value === 1) {
            keys.push(path);
        } else if (typeof value === 'object' && value !== null) {
            keys = keys.concat(getKeysWithValueOne(value, path));
        }
    }
    return keys;
}

function setValueByPath(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((acc, key) => acc?.[key], obj);
    if (target && lastKey in target) {
        target[lastKey] = value;
    }
}

async function askUser(question) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function connectSocket(props) {
    const { email, password, keyCheck, valueCheck, item } = props;
    globalItem = item;

    let user = {};

    if (!cookieCache[email]) {
        const data = await loginGetCookies(email, password);
        if (!data) {
            console.log(redBold(`❌ Không lấy được cookie, bỏ qua.`));
            return;
        }
        cookieCache[email] = data.cookies;
        user = data.user || {};
    }

    console.log("\n" + yellowBold(`=== [KẾT NỐI TỚI WEBSOCKET ===`));

    const socket = new WebSocket("wss://mongtutien.online/ws", {
        headers: {
            "accept-language": "en-US,en;q=0.9,vi;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
            cookie: cookieCache[email],
        },
    });

    socket.on("open", () => {
        console.log(greenBold(`✅ Kết nối WebSocket thành công`));
    });

    socket.on("message", async (message) => {
        try {
            const data = JSON.parse(message.toString());
            switch (data.type) {
                case "sessionKey":
                    const key = {
                        aesKey: Buffer.from(data.payload.aesKey, "base64"),
                        hmacKey: Buffer.from(data.payload.hmacKey, "base64"),
                        staticIv: Buffer.from(data.payload.iv, "base64")
                    };
                    keysCache[email] = key;
                    sendEncrypted({
                        socket,
                        obj: { type: 'player:inspect', payload: { targetId: user.userId } },
                        key
                    });
                    break;

                case "state":
                case "player:inspect": {
                    const payload = data.payload;
                    if (!payload) return;

                    // === find scrolls ===
                    let keyRefine = "";
                    if (Array.isArray(payload.items)) {
                        const mysticScroll = payload.items.find(it => it.item?.itemId === "refine_scroll_mystic");
                        const basicScroll = payload.items.find(it => it.item?.itemId === "refine_scroll_basic");
                        const mysticQty = mysticScroll?.quantity || 0;
                        const basicQty = basicScroll?.quantity || 0;

                        if (mysticQty >= 10) keyRefine = "refine_scroll_mystic";
                        else if (basicQty >= 10) keyRefine = "refine_scroll_basic";
                    }

                    if (!keyRefine) {
                        console.log(redBold("❌ Bạn đã hết đá tẩy"));
                        process.exit(1);
                    }

                    // === find current item ===
                    const activeKeys = getKeysWithValueOne(globalItem);
                    let currentItem = null;
                    let keyPath = "";

                    for (const path of activeKeys) {
                        const item = getValueByPath(payload, path);
                        if (item) {
                            currentItem = item;
                            keyPath = path;
                            break;
                        }
                    }

                    if (!currentItem) {
                        console.log(greenBold("✅ Tất cả trang bị đã tẩy luyện xong!"));
                        process.exit(1);
                    }

                    console.log(`Trang bị hiện tại: ${currentItem.name}`);
                    const refineStats = currentItem.refineStats ?? {};

console.log("🔹 Chỉ số trang bị:");
if (Object.keys(refineStats).length === 0) {
    console.log("  - (chưa có dòng tẩy)");
} else {
    const percentKeys = [
        "atkPercent","defPercent","hpPercent","speedPercent",
        "allStatsPercent","critChance","critDamage","damageReduction",
        "dodge","counter","lifesteal","antiLifesteal",
        "antiCounterChance","antiCritChance","antiCritDamage",
        "antiDodge","multiHitChance","antiMultiHitChance",
        "finalDamageBonus","debuff_resist","dropBoost",
        "cultivationBonus","spiritStoneBonus"
    ];

    for (const [key, value] of Object.entries(refineStats)) {
        const isPercent = percentKeys.includes(key);
        const showValue = isPercent
            ? `${(value * 100).toFixed(2)}%`
            : value;

        console.log(`  - ${statLabelMap[key] || key} ${showValue}`);
    }
}


                    // === ask user if 5 refine stats ===
                    const refineKeys = Object.entries(currentItem.refineStats || {}).filter(([, v]) => v > 0);
                    if (refineKeys.length ===  6) {
                        const answer = await askUser("⚠️ Trang bị có 5 dòng. Bạn có muốn lưu lại không? (y/n): ");
                        if (answer === "y") {
                            setValueByPath(globalItem, keyPath, 0);
                            await saveData();

                            sendEncrypted({
                                socket,
                                obj: { type: 'player:inspect', payload: { targetId: user.userId } },
                                key: keysCache[email]
                            });
                            console.log("✅ Đã lưu và gửi yêu cầu player:inspect");
                            return;
                        } else {
                            console.log("❌ Bỏ qua lưu dữ liệu.");
                        }
                    }

                    // === value check condition ===
                    if (((currentItem.refineStats || {})[keyCheck] ?? 0) > Number(valueCheck)) {
                        setValueByPath(globalItem, keyPath, 0);
                        await saveData();

                        sendEncrypted({
                            socket,
                            obj: { type: 'player:inspect', payload: { targetId: user.userId } },
                            key: keysCache[email]
                        });
                        return;
                    }

                    // === auto refine ===
                    setTimeout(() => {
                        sendEncrypted({
                            socket,
                            obj: {
                                type: "equipment:refine",
                                payload: {
                                    equipmentId: currentItem._id,
                                    stoneType: 'high',
                                    itemId: keyRefine,
                                },
                            },
                            key: keysCache[email]
                        });
                    }, 1000);
                    break;
                }

                case "system":
                    console.log(yellowBold(`[${user.name}] ${data.payload.text}`));
                    break;

                case "warn":
                    console.log(yellowBold(`[${user.name}] ${data?.payload?.text}`));
                    break;
            }
        } catch (err) {
            console.error(`❌ Lỗi xử lý message:`, err);
        }
    });
}

async function saveData() {
    try {
        const newData = {
            ...globalData,
            item: globalItem
        };

        await writeJsonAtomic("data.json", newData);
        console.log(greenBold(`✅ Đã lưu dữ liệu vào data.json`));
        return true;
    } catch (err) {
        console.error(redBold("❌ Ghi dữ liệu thất bại:"), err);
        return false;
    }
}

async function attackBossAccount() {
    const accountsRaw = readAccountsJsonFile(DATA_PATH) || [];
    globalData = accountsRaw;
    connectSocket(accountsRaw);
}

attackBossAccount();
