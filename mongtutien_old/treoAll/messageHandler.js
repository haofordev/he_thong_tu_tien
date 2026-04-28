import {
    sendEncrypted,
    logWithTime,
    yellowBold,
    greenBold,
    redBold,
    blueBold,
    isInTimeRange,
    logLineBreak,
    mapEncounter,
    replaceHTMLSystem,
    lootToString,
    getDurationTime,
} from "../utils.js";

import WebSocket from "ws";

export const COMMON_TIMEOUT = 2 * 60 * 1000


export const state = {
    keysCache: {},
    timeoutAcc: {},
    cookieCache: {},
    socketCache: {},
    socketBossCache: {},
    pingInterval: {},
    isAttackBoss: {},
    indexBoss: 0,
    indexUser: 0,
    timeoutNextUser: null,
    deviceId: {},
    bossId: "",
    logTimeoutByBoss: {},
    lastBossRequest: {},
    isJoinParty: {},
    joinPartyInterval: {},

    joinNineRealms: {},
    nineRealmInterval: {},
    nineRealmTimeout: {},
    leaveNineRealmsSent: {},

    personalBossInterval: {},
    missionInterval: {},
    isFullTower: {},
    attackDelayTimeout: {},
    onlineStateInterval: {},
    sendQueue: {},
    hongmongInterval: {},
    mailListInterval: {},
    phucDiaTimeout: {},
    betAmount: {},
    currentNumberBet: {},
    currentArrayBet: {},
    storeBetNumber: {},
    sectQuestInterval: {},
};


export function cleanupOnSocketClose(email) {
    // Clear all intervals
    const intervalKeys = [
        "pingInterval",
        "onlineStateInterval",
        "personalBossInterval",
        "missionInterval",
        "joinPartyInterval",
        "nineRealmInterval",
        "hongmongInterval",
        'mailListInterval',
        "sectQuestInterval"
    ];
    intervalKeys.forEach((key) => {
        if (state[key]?.[email]) {
            clearInterval(state[key][email]);
            delete state[key][email];
        }
    });

    // Clear all timeouts
    if (state.timeoutAcc[email]) {
        clearTimeout(state.timeoutAcc[email]);
        delete state.timeoutAcc[email];
    }
    if (state.timeoutNextUser) {
        clearTimeout(state.timeoutNextUser);
        state.timeoutNextUser = null;
    }
    if (state.nineRealmTimeout?.[email]) {
        clearTimeout(state.nineRealmTimeout?.[email]);
        delete state.nineRealmTimeout?.[email];
    }

    // Reset flags
    delete state.isAttackBoss[email];
    delete state.isJoinParty[email];
    delete state.joinNineRealms[email];
    delete state.isFullTower[email];
    delete state.lastBossRequest[email];

    // Clear socket references
    if (state.socketCache[email]) {
        delete state.socketCache[email];
    }
    if (state.socketBossCache[email]) {
        delete state.socketBossCache[email];
    }

    console.log(redBold(`🛑 Cleaned up all intervals and timeouts for [${email}]`));
}


export function resetStatePersonalBoss(email) {
    state.isAttackBoss[email] = {};
    state.indexBoss = 0;
}

export async function messageHandler(props) {
    const { email, data, user } = props
    try {
        switch (data.type) {
            case "sessionKey": handleSessionKey(props); break;
            //case "tower:info": handleTowerInfo(props); break;
            case "mission:list": handleClaimMission(props); break;
            case "treasureHunt:update": handleLogTreasureHuntCollected(props); break;
            case "treasureHunt:end": handleLogEndTreasureHunt(props); break;
            //case "mail:list": handleMailList(props); break;
            case "phuc_dia:state": handlePhucDiaState(props); break;
            case "sect:quest_list": handleSectQuest(props); break;
            case "nine-realms:enter_success":
                logLineBreak(true);
                logWithTime(greenBold(`[${user.name}] ✅ Tham gia Cửu Giới Tranh Bá`));
                logLineBreak();
                break;

            case "nine-realms:update":
                const payload = data?.payload
                logWithTime(greenBold(`[${user.name}] tại Cửu Giới Tranh Bá: ${lootToString(payload?.collectedLoot || {})}`))
                break;
            case "nine-realms:end":
                clearInterval(state.nineRealmInterval[email])
                logLineBreak(true);
                logWithTime(redBold(`[${user.name}] ✅ Kết thúc Cửu Giới Tranh Bá`));

                logLineBreak();
                break;
            case "warn": handleLogWarn(props); break;
            case "system":
                let text = replaceHTMLSystem.reduce((acc, item) => acc.replaceAll(item, ""), data.payload.text || "");
                logWithTime(greenBold(`📜 Hệ thống: [${user.name}] ${text}`));
                console.log("");
                break;
        }
    } catch (err) {
        console.error("❌ Error in messageHandler:", err);
    }
}

export function handleSessionKey(props) {
    const { email, socket, data, user, reconnect } = props;

    if (!state.currentNumberBet[email]) {
        state.currentNumberBet[email] = 0
    }

    if (!state.betAmount[email]) {
        state.betAmount[email] = 50000
    }


    logLineBreak(true);
    logWithTime(greenBold(`[${user.name}] ✅ Kết nối Websocket và lấy key thành công `));
    logLineBreak();

    // Save keys
    state.keysCache[email] = {
        aesKey: Buffer.from(data.payload.aesKey, "base64"),
        hmacKey: Buffer.from(data.payload.hmacKey, "base64"),
        staticIv: Buffer.from(data.payload.iv, "base64"),
    };
    const key = state.keysCache[email];

    // Helper: safe send
    const send = (obj) =>
        sendEncryptedQueue({ socket, obj, key, onError: reconnect });

    // --- Init messages ---
    [
        { type: "tower:info", payload: {} },
        { type: "reset:state", payload: {} },
        { type: "init", payload: { userId: user.userId, deviceId: state.deviceId[email] } },
        { type: "sect:quest_getList", payload: {} },
        { type: "treasureHunt:getState", payload: {} },
        { type: "mail:getList", payload: {} },
        { type: "treasureHunt:enter", payload: {} },
        { type: "phuc_dia:getState", payload: {} },
    ].forEach(send);

    // --- Intervals ---
    const setSafeInterval = (name, fn, timeout) => {
        if (state[name]?.[email]) clearInterval(state[name][email]);
        state[name][email] = setInterval(fn, timeout);
    };

    // Keepalive ping
    setSafeInterval("pingInterval", () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        send({ type: "init", payload: { userId: user.userId, deviceId: state.deviceId[email] } });
        socket.send(JSON.stringify({ type: "ping", data: { deviceId: state.deviceId[email] } }));
    }, 10 * 1000);

    // Online rewards
    setSafeInterval("onlineStateInterval", () => send({ type: "phuc_dia:getState" }), 5 * 60 * 1000);

    // 🔹 Mails (new interval)
    setSafeInterval("mailListInterval", () => {
        send({ type: "mail:getList", payload: {} });
    }, COMMON_TIMEOUT);

    // 🔹 Quest Sect (new interval)
    setSafeInterval("sectQuestInterval", () => {
        send({ type: "sect:quest_getList", payload: {} });
    }, COMMON_TIMEOUT);


    handleGetMission(props);
    joinNineRealms(props);
}


function handleTowerInfo(props) {
    const { email, socket, data, user, reconnect } = props;
    const floor = data.payload?.floor;

    // If tower is full, no further action needed
    if (state.isFullTower[email]) return;

    logWithTime(greenBold(`[${user.name}] Tầng hiện tại: ${floor}`));
    console.log("");

    // Clear previous attack and reset timeouts if any
    clearTimeout(state.attackDelayTimeout?.[email]);
    clearTimeout(state.resetTimeout?.[email]);
    delete state.attackDelayTimeout?.[email];
    delete state.resetTimeout?.[email];

    // Schedule attack after 5s delay
    state.attackDelayTimeout = state.attackDelayTimeout || {};
    state.attackDelayTimeout[email] = setTimeout(() => {
        logWithTime(redBold(`[${user.name}] ⚔️ Gửi khiêu chiến tầng: ${floor}`));
        console.log("");
        sendEncryptedQueue({
            socket,
            obj: { type: "tower:challenge", payload: { floor } },
            key: state.keysCache[email],
            onError: reconnect,
        });

        // Schedule reset after 10s if no floor update is received
        state.resetTimeout = state.resetTimeout || {};
        state.resetTimeout[email] = setTimeout(() => {
            logWithTime(yellowBold(`[${user.name}] ⏱ Không có phản hồi - Gửi reset Tháp`));
            sendEncryptedQueue({
                socket,
                obj: { type: "tower:info", payload: {} },
                key: state.keysCache[email],
                onError: reconnect,
            });
            delete state.resetTimeout[email];
        }, 10000);

        delete state.attackDelayTimeout[email];
    }, 5000);
}



export function sendBossRequests(props) {
    const { email, socket, user, reconnect } = props
    const now = Date.now();
    if (state.lastBossRequest[email] && now - state.lastBossRequest[email] < 30000) return;

    state.lastBossRequest[email] = now;

    Object.keys(bossTypeMap).forEach((type, i) => {
        sendEncryptedQueue({
            socket,
            obj: { type },
            key: state.keysCache[email],
            onError: reconnect,
        });
    });
}

export function joinNineRealms({ socket, email, user, nineRealm, reconnect }) {
    const joinRanges = [
        [12, 0, 13, 0], // 12:00–13:00
        [15, 0, 16, 0], // 15:00–16:00
        [18, 0, 19, 0], // 18:00–19:00
        [21, 0, 22, 0], // 21:00–22:00
    ];

    function checkAndJoin() {
        const inRange = joinRanges.some(([sh, sm, eh, em]) => isInTimeRange(sh, sm, eh, em));

        if (inRange) {
            let currentRange = null;

            for (const range of joinRanges) {
                const [sh, sm, eh, em] = range;
                if (isInTimeRange(sh, sm, eh, em)) {
                    currentRange = range;
                    break;
                }
            }

            if (!state.joinNineRealms[email]) {
                sendEncryptedQueue({
                    socket,
                    obj: { type: "nine-realms:getState", payload: {} },
                    key: state.keysCache[email],
                    onError: reconnect,
                });

                sendEncryptedQueue({
                    socket,
                    obj: { type: "nine-realms:enter", payload: { realm: nineRealm } },
                    key: state.keysCache[email],
                    onError: reconnect,
                });

                state.nineRealmInterval[email] = setInterval(() => {
                    sendEncryptedQueue({
                        socket,
                        obj: { type: "nine-realms:tick", payload: {} },
                        key: state.keysCache[email],
                        onError: reconnect,
                    });
                }, 5100)

                logLineBreak(true);
                logWithTime(blueBold(`[${user?.name}] ✅ Gửi yêu cầu gia Cửu Giới Tranh Bá`));
                logLineBreak();
                state.joinNineRealms[email] = true;
            } else {

                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const [sh, sm, eh, em] = currentRange; // You must store this when matching range

                const end = eh * 60 + em;
                const minutesLeft = end - currentMinutes;

                if (minutesLeft <= 5 && !state.leaveNineRealmsSent[email]) {

                    clearInterval(state.nineRealmInterval[email]);

                    sendEncryptedQueue({
                        socket,
                        obj: { type: "nine-realms:leave", payload: {} },
                        key: state.keysCache[email],
                        onError: reconnect,
                    });

                    setTimeout(() => {
                        joinNineRealms({ socket, email, user, nineRealm, reconnect });
                    }, 5000)

                    logWithTime(redBold(`[${user?.name}] ⛔ Tự động rời Cửu Giới (còn ${minutesLeft} phút)`));

                    state.leaveNineRealmsSent[email] = true;
                    state.joinNineRealms[email] = false;
                }

            }
        } else {
            if (state.joinNineRealms[email] !== false) {
                logLineBreak(true);
                logWithTime(redBold(`[${user?.name}] ⚠️ Chưa đến giờ tham gia Cửu Giới Tranh Bá`));
                logLineBreak();
            }
            state.joinNineRealms[email] = false;
            state.leaveNineRealmsSent[email] = false

        }
        clearTimeout(state.nineRealmTimeout[email]);
        state.nineRealmTimeout[email] = setTimeout(checkAndJoin, COMMON_TIMEOUT);
    }

    checkAndJoin();
}

function handleGetMission(props) {
    const { email, socket, data, user, reconnect } = props

    sendEncryptedQueue({
        socket,
        obj: { type: "mission:list", payload: {} },
        key: state.keysCache[email],
        onError: reconnect,
    });

    if (state.missionInterval[email]) {
        clearInterval(state.missionInterval[email]);
    }
    setInterval(() => {
        sendEncryptedQueue({
            socket,
            obj: { type: "mission:list", payload: {} },
            key: state.keysCache[email],
            onError: reconnect,
        });
    }, COMMON_TIMEOUT);
}

function handleClaimMission(props) {
    const { email, socket, data, user, reconnect } = props

    logWithTime(blueBold(`[${user?.name}] Lấy thành công danh sách nhiệm vụ \n`));
    const payload = data?.payload
    if (payload && payload.length) {
        const unReceived = payload.filter((mission) => mission?.completed == true && mission?.claimed == false);
        if (!unReceived.length) {
            logWithTime(redBold(` [${user?.name}] Tất cả nhiệm vụ đã nhận \n`));
        } else {
            unReceived.forEach((mission, i) => {
                setTimeout(() => {
                    logWithTime(blueBold(`[${user?.name}] Nhận thưởng nhiệm vụ: ${mission?.name} \n`));
                    sendEncryptedQueue({
                        socket,
                        obj: {
                            type: "mission:claim",
                            payload: {
                                missionId: mission?.id
                            }
                        },
                        key: state.keysCache[email],
                        onError: reconnect,
                    });
                }, 500 * i)
            })
        }
    }
}


function handleLogWarn(props) {
    const { email, data, user } = props
    const text = data?.payload?.text || ""

    logLineBreak(true);
    console.log(yellowBold(`⚠️ Cảnh báo: [${user.name}]`, text));
    logLineBreak();

    if (text.includes("tầng tối đa") || text.includes("đã vượt quá tầng tối đa!")) {

        state.isFullTower[email] = true
    }
}

function handleLogEndTreasureHunt(props) {
    const { socket, email, user } = props
    logLineBreak(true);
    logWithTime(redBold(`[${user.name}] Kết thúc tầm bảo và vào lại sao 5s`));
    setTimeout(() => {
        sendEncryptedQueue({
            socket,
            obj: { type: "treasureHunt:enter", payload: {} },
            key: state.keysCache[email]
        });
    }, 500)
    logLineBreak();
}

function handleLogTreasureHuntCollected(props) {
    const { data, user } = props
    const payload = data?.payload

    logLineBreak(true);
    logWithTime(greenBold(`[${user?.name}] ✅ Thời gian tham gia tầm bảo: ${getDurationTime(payload.startTime, new Date())}`))
    logWithTime(greenBold(`[${user?.name}] ✅ Trong tầm bảo đã nhận: ${lootToString(payload?.collectedLoot || {})}`));
    logLineBreak();
}

function handleHongMongStatus(props) {
    const { data, socket, email, user } = props
    const payload = data?.payload
    if (!payload) {
        return
    }
    console.log("")
    if (payload?.minutesAccumulated > 60) {
        sendEncrypted({
            socket,
            obj: { type: "hongmong:claim", payload: {} },
            key: state.keysCache[email]
        });
    } else {
        logWithTime(yellowBold(`[${user?.name}] Hồng Mông Khoáng đã tích lũy ${payload.minutesAccumulated} phút`))
    }
}

function handlePhucDiaState(props) {
    const { data, email, user, socket } = props
    const payload = data?.payload
    if (!payload) {
        return
    }
    if (state.phucDiaTimeout[email]) {
        clearTimeout(state.phucDiaTimeout[email])
    }

    state.phucDiaTimeout[email] = setTimeout(() => {
        sendEncryptedQueue({
            socket,
            obj: { type: "phuc_dia:getState", payload: {} },
            key: state.keysCache[email]
        })
    }, 30 * 1000)

    const listMice = payload?.mice || [];

    // slots that are not null
    const nonNullIndexes = payload.slots
        .map((item, index) => (item !== null ? index : null))
        .filter(index => index !== null);

    // collect slotIndexes that mice are already using
    const occupiedIndexes = listMice
        .map(m => m.target?.slotIndex)
        .filter(idx => idx !== undefined && idx !== null);

    // keep only indexes not used by mice
    let availableIndexes = nonNullIndexes.filter(
        index => !occupiedIndexes.includes(index)
    );

    listMice.forEach((mice, index) => {

        switch (mice.status) {
            case "harvest_ready":
                logWithTime(greenBold(`[${user.name}] Chuột ${mice.id} thu hoạch xong nhận thưởng`));
                console.log("")
                sendEncryptedQueue({
                    socket,
                    obj: { type: "phuc_dia:claimHarvest", payload: { mouseId: mice.id } },
                    key: state.keysCache[email]
                });
                break;
            case "harvesting":
                const now = new Date().getTime();
                const timeLeft = new Date(mice.target?.completeAt)?.getTime()
                const diffMs = timeLeft - now;
                const diffSec = Math.floor(diffMs / 1000);
                const min = Math.floor(diffSec / 60);
                const sec = diffSec % 60;
                logWithTime(yellowBold(`[${user.name}] Chuột ${mice.id} đang thu hoạch còn lại ${min}p:${sec}giây`));
                console.log("")
                if (now > timeLeft) {
                    sendEncryptedQueue({
                        socket,
                        obj: { type: "phuc_dia:tick", payload: {} },
                        key: state.keysCache[email]
                    });
                    return
                }
                break;
            case "idle":
                if (availableIndexes.length == 0) {
                    logWithTime(redBold(`[${user.name}] Ruộng đã hết ô trống chờ reset`));
                    return
                }
                logWithTime(yellowBold(`[${user.name}] Chuột ${mice.id} đang rãnh và thu hoạch ô ${availableIndexes[0]}`));
                console.log("")
                sendEncryptedQueue({
                    socket,
                    obj: {
                        type: "phuc_dia:startHarvest",
                        payload: {
                            mouseId: mice.id,
                            slotIndex: availableIndexes[0]
                        }
                    },
                    key: state.keysCache[email]
                });
                availableIndexes.slice(1)
                break;
        }
    });
}

function handleSectQuest(props) {
    const { data, email, user, socket } = props
    const payload = data?.payload
    if (!payload) {
        return
    }

    const listQuests = data.payload
    const result = listQuests.find(q => !q.claimed && q.progress === q.config.requirement.count);
    if (result) {
        logWithTime(yellowBold(`[${user.name}] nhận thưởng nhiệm vụ tông môn ${result.config.description || result.config.name}`));
        sendEncryptedQueue({
            socket,
            obj: { type: "sect:quest_claimReward", payload: { questId: result.questId } },
            key: state.keysCache[email]
        });
    } else {
        logWithTime(yellowBold(`[${user.name}] Đã nhận tất cả nhiệm vụ tông môn`));
    }
}

export function sendEncryptedQueue({ socket, obj, key, onError, email }) {
    if (!state.sendQueue[email]) {
        state.sendQueue[email] = Promise.resolve(); // Initialize queue for this email
    }

    // Chain the next message with 500ms delay
    state.sendQueue[email] = state.sendQueue[email].then(() => {
        return new Promise((resolve) => {
            setTimeout(() => {
                sendEncrypted({ socket, obj, key, onError });
                resolve();
            }, 500); // 500ms delay
        });
    }).catch(err => {
        console.error(`Error in sendEncryptedQueue for ${email}:`, err);
    });
}
