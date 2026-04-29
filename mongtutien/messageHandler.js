import {
    sendEncrypted,
    sendCommand,
    logWithTime,
    yellowBold,
    greenBold,
    redBold,
    blueBold,
    purpleBold,
    colors,
    log
} from "./utils.js";

import WebSocket from "ws";

export const COMMON_TIMEOUT = 2 * 60 * 1000;

export const state = {
    keysCache: {},
    timeoutAcc: {},
    cookieCache: {},
    socketCache: {},
    pingInterval: {},
    phucDiaTimeout: {},
    missionInterval: {},
    mailListInterval: {},
    sectQuestInterval: {},
    sendQueue: {},
    nineRealmInterval: {},
    nineRealmTimeout: {},
    joinNineRealms: {},
    leaveNineRealmsSent: {},
    isFullTower: {},
    attackDelayTimeout: {},
    resetTimeout: {},
    onlineStateInterval: {},
    personalBossInterval: {},
    personalBossList: {},
};

export function cleanupOnSocketClose(email) {
    const intervalKeys = [
        "pingInterval",
        "missionInterval",
        "mailListInterval",
        "sectQuestInterval",
        "nineRealmInterval",
        "onlineStateInterval"
    ];
    intervalKeys.forEach((key) => {
        if (state[key]?.[email]) {
            clearInterval(state[key][email]);
            delete state[key][email];
        }
    });

    if (state.phucDiaTimeout[email]) {
        clearTimeout(state.phucDiaTimeout[email]);
        delete state.phucDiaTimeout[email];
    }

    if (state.nineRealmTimeout?.[email]) {
        clearTimeout(state.nineRealmTimeout?.[email]);
        delete state.nineRealmTimeout?.[email];
    }

    if (state.attackDelayTimeout?.[email]) {
        clearTimeout(state.attackDelayTimeout[email]);
        delete state.attackDelayTimeout[email];
    }

    if (state.resetTimeout?.[email]) {
        clearTimeout(state.resetTimeout[email]);
        delete state.resetTimeout[email];
    }

    delete state.keysCache[email];
    delete state.socketCache[email];
    delete state.joinNineRealms[email];
    delete state.isFullTower[email];

    log(redBold(`🛑 Đã dọn dẹp tất cả interval và timeout cho [${email}]`));
}

export async function messageHandler(props) {
    const { email, data, user, socket, reconnect } = props;
    const send = (type, payload = {}) => {
        if (state.keysCache[email]) {
            sendEncryptedQueue({ socket, obj: { type, payload }, key: state.keysCache[email], onError: reconnect, email });
        } else {
            sendCommand(socket, type, payload);
        }
    };

    function startAutomation() {
        if (state.pingInterval[email]) return;

        log(`[${user.name}] ⚙️ Khởi tạo chu kỳ tự động...`, colors.dim);

        const setSafeInterval = (name, fn, timeout) => {
            if (state[name]?.[email]) clearInterval(state[name][email]);
            state[name][email] = setInterval(fn, timeout);
        };

        setSafeInterval("pingInterval", () => {
            if (socket.readyState !== WebSocket.OPEN) return;
            socket.send(JSON.stringify({ v: 2, op: "pi" }));
        }, 10 * 1000);

        setSafeInterval("missionInterval", () => send("mission:list"), COMMON_TIMEOUT);
        setSafeInterval("onlineStateInterval", () => send("player:onlineState"), 30 * 1000);
        setSafeInterval("sectQuestInterval", () => send("sect:quest_getList"), COMMON_TIMEOUT);
        setSafeInterval("personalBossInterval", () => send("personal:boss:list"), COMMON_TIMEOUT);

        send("tower:info");
        send("phuc_dia:getState");
        send("personal:boss:list");
    }

    try {
        switch (data.type) {
            case "hello":
                log(`[${user.name}] 🚀 Khởi tạo phiên kết nối...`);
                startAutomation(); // Start pinging right away
                send("init", { userId: user.userId });
                break;
            case "state":
                if (data.payload) {
                    state.personalBossInterval[email] = data.payload;
                    log(`[${user.name}] 👤 Trạng thái nhân vật sẵn sàng.`, colors.green);
                }
                break;
            case "sessionKey": handleSessionKey(props); break;
            case "tower:info": handleTowerInfo(props); break;
            case "mission:list": handleClaimMission(props); break;
            case "phuc_dia:state": handlePhucDiaState(props); break;
            case "sect:quest_list": handleSectQuest(props); break;
            case "nine-realms:enter_success":
                logWithTime(greenBold(`[${user.name}] ✅ Tham gia Cửu Giới Tranh Bá`));
                break;
            case "nine-realms:update":
                const payload = data?.payload;
                logWithTime(greenBold(`[${user.name}] tại Cửu Giới Tranh Bá: ${JSON.stringify(payload?.collectedLoot || {})}`));
                break;
            case "nine-realms:end":
                clearInterval(state.nineRealmInterval[email]);
                logWithTime(redBold(`[${user.name}] ✅ Kết thúc Cửu Giới Tranh Bá`));
                break;
            case "personal:boss:list":
                handlePersonalBossList(props);
                break;
            case "warn": handleLogWarn(props); break;
            case "system":
                logWithTime(greenBold(`📜 Hệ thống: [${user.name}] ${data.payload.text || ""}`));
                break;
        }
    } catch (err) {
        console.error("❌ Lỗi trong messageHandler:", err);
    }
}

export function handleSessionKey(props) {
    const { email, socket, data, user, reconnect } = props;

    logWithTime(greenBold(`[${user.name}] ✅ Kết nối Websocket và lấy key thành công`));

    state.keysCache[email] = {
        aesKey: Buffer.from(data.payload.aesKey, "base64").toString("hex"),
        hmacKey: Buffer.from(data.payload.hmacKey, "base64").toString("hex"),
        staticIv: Buffer.from(data.payload.iv, "base64").toString("hex"),
    };
    
    const key = state.keysCache[email];

    const send = (obj) => sendEncryptedQueue({ socket, obj, key, onError: reconnect, email });

    [
        { type: "tower:info", payload: {} },
        { type: "reset:state", payload: {} },
        { type: "init", payload: { userId: user.userId } },
        { type: "sect:quest_getList", payload: {} },
        { type: "treasureHunt:getState", payload: {} },
        { type: "mail:getList", payload: {} },
        { type: "treasureHunt:enter", payload: {} },
        { type: "phuc_dia:getState", payload: {} },
    ].forEach(send);

    const setSafeInterval = (name, fn, timeout) => {
        if (state[name]?.[email]) clearInterval(state[name][email]);
        state[name][email] = setInterval(fn, timeout);
    };

    setSafeInterval("pingInterval", () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ v: 2, op: "pi" }));
    }, 10 * 1000);

    setSafeInterval("missionInterval", () => send({ type: "mission:list", payload: {} }), COMMON_TIMEOUT);
    setSafeInterval("mailListInterval", () => send({ type: "mail:getList", payload: {} }), COMMON_TIMEOUT);
    setSafeInterval("sectQuestInterval", () => send({ type: "sect:quest_getList", payload: {} }), COMMON_TIMEOUT);

    setSafeInterval("phucDiaInterval", () => send({ type: "phuc_dia:getState", payload: {} }), 30 * 1000);
}

function handleClaimMission(props) {
    const { email, socket, data, user, reconnect } = props;
    const payload = data?.payload;
    if (payload && payload.length) {
        const unReceived = payload.filter((mission) => mission?.completed && !mission?.claimed);
        unReceived.forEach((mission, i) => {
            setTimeout(() => {
                logWithTime(blueBold(`[${user?.name}] Nhận thưởng nhiệm vụ: ${mission?.name}`));
                sendEncryptedQueue({
                    socket,
                    obj: { type: "mission:claim", payload: { missionId: mission?.id } },
                    key: state.keysCache[email],
                    onError: reconnect,
                    email
                });
            }, 500 * i);
        });
    }
}

function handlePhucDiaState(props) {
    const { data, email, user, socket, reconnect } = props;
    const payload = data?.payload;
    if (!payload) return;

    const listMice = payload?.mice || [];
    const nonNullIndexes = payload.slots
        .map((item, index) => (item !== null ? index : null))
        .filter(index => index !== null);

    const occupiedIndexes = listMice
        .map(m => m.target?.slotIndex)
        .filter(idx => idx !== undefined && idx !== null);

    let availableIndexes = nonNullIndexes.filter(index => !occupiedIndexes.includes(index));

    listMice.forEach((mice) => {
        switch (mice.status) {
            case "harvest_ready":
                logWithTime(greenBold(`[${user.name}] Chuột ${mice.id} thu hoạch xong`));
                sendEncryptedQueue({
                    socket,
                    obj: { type: "phuc_dia:claimHarvest", payload: { mouseId: mice.id } },
                    key: state.keysCache[email],
                    onError: reconnect,
                    email
                });
                break;
            case "idle":
                if (availableIndexes.length > 0) {
                    const slotIndex = availableIndexes.shift();
                    logWithTime(yellowBold(`[${user.name}] Chuột ${mice.id} thu hoạch ô ${slotIndex}`));
                    sendEncryptedQueue({
                        socket,
                        obj: { type: "phuc_dia:startHarvest", payload: { mouseId: mice.id, slotIndex } },
                        key: state.keysCache[email],
                        onError: reconnect,
                        email
                    });
                }
                break;
        }
    });
}

function handleSectQuest(props) {
    const { data, email, user, socket, reconnect } = props;
    const listQuests = data.payload || [];
    const result = listQuests.find(q => !q.claimed && q.progress === q.config.requirement.count);
    if (result) {
        logWithTime(yellowBold(`[${user.name}] nhận thưởng nhiệm vụ tông môn ${result.config.description || result.config.name}`));
        sendEncryptedQueue({
            socket,
            obj: { type: "sect:quest_claimReward", payload: { questId: result.questId } },
            key: state.keysCache[email],
            onError: reconnect,
            email
        });
    }
}

function handleLogWarn(props) {
    const { email, data, user } = props;
    const text = data?.payload?.text || "";
    logWithTime(yellowBold(`⚠️ Cảnh báo: [${user.name}] ${text}`));

    if (text.includes("tầng tối đa") || text.includes("đã vượt quá tầng tối đa!")) {
        state.isFullTower[email] = true;
    }
}

function handleTowerInfo(props) {
    const { email, socket, data, user, reconnect } = props;
    const floor = data.payload?.floor;

    if (state.isFullTower[email]) return;

    logWithTime(greenBold(`[${user.name}] Tầng hiện tại: ${floor}`));

    if (state.attackDelayTimeout[email]) clearTimeout(state.attackDelayTimeout[email]);
    if (state.resetTimeout[email]) clearTimeout(state.resetTimeout[email]);

    state.attackDelayTimeout[email] = setTimeout(() => {
        logWithTime(redBold(`[${user.name}] ⚔️ Gửi khiêu chiến tầng: ${floor}`));
        sendEncryptedQueue({
            socket,
            obj: { type: "tower:challenge", payload: { floor } },
            key: state.keysCache[email],
            onError: reconnect,
            email
        });

        state.resetTimeout[email] = setTimeout(() => {
            logWithTime(yellowBold(`[${user.name}] ⏱ Không có phản hồi - Gửi reset Tháp`));
            sendEncryptedQueue({
                socket,
                obj: { type: "tower:info", payload: {} },
                key: state.keysCache[email],
                onError: reconnect,
                email
            });
        }, 15000);
    }, 5000);
}

export function sendEncryptedQueue({ socket, obj, key, onError, email }) {
    if (!state.sendQueue[email]) {
        state.sendQueue[email] = Promise.resolve();
    }

    state.sendQueue[email] = state.sendQueue[email].then(() => {
        return new Promise((resolve) => {
            setTimeout(() => {
                sendEncrypted({ socket, obj, key, onError });
                resolve();
            }, 500);
        });
    }).catch(err => {
        console.error(`Lỗi trong sendEncryptedQueue cho ${email}:`, err);
    });
}

function handlePersonalBossList(props) {
    const { email, data, user, socket } = props;
    const bosses = data.payload || [];
    state.personalBossList[email] = bosses;

    const now = Date.now();
    const readyBosses = bosses.filter(boss => {
        if (!boss.spawnedAt) return true; // Ready if no spawn time (never killed)
        const spawnTime = new Date(boss.spawnedAt).getTime();
        return spawnTime <= now;
    });

    if (readyBosses.length > 0) {
        log(`[${user.name}] 🎯 Phát hiện ${readyBosses.length} Boss cá nhân khả dụng.`, colors.yellow);
        readyBosses.forEach(boss => {
            attackPersonalBoss({ socket, email, boss, user });
        });
    } else {
        // Find next boss to spawn
        const nextBoss = bosses
            .filter(b => b.spawnedAt)
            .sort((a, b) => new Date(a.spawnedAt) - new Date(b.spawnedAt))[0];
        if (nextBoss) {
            const waitMs = new Date(nextBoss.spawnedAt).getTime() - now;
            const waitMin = Math.ceil(waitMs / 60000);
            if (waitMin > 0) {
                log(`[${user.name}] ⏳ Boss cá nhân tiếp theo hồi sinh sau ~${waitMin} phút.`, colors.dim);
            }
        }
    }
}

function attackPersonalBoss({ socket, email, boss, user }) {
    log(`[${user.name}] ⚔️ Đang trảm Boss cá nhân: ${boss.name || boss.id}`, colors.red);
    sendCommand(socket, "personal:boss:attack", { bossId: boss.id });
}

