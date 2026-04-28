import { getUserProfile } from "../login.js";
import { blueBold, greenBold, logLineBreak, logWithTime, redBold, yellowBold, getRestTime, socketBossDomain } from "../utils.js";
import WebSocket from 'ws';

const socketBossCache = {}
const currentBossId = {};
const lastAttackTime = {};
const isLeaveAllBoss = {}
const intervalAttackBoss = {}
const intervalBossWorld = {}
const intervalPing = {}
const timeoutCheck = {}

export function connectSocketBoss(props) {
    const { user, email, cookies } = props

    const socket = new WebSocket(socketBossDomain, {
        headers: {
            "accept-language": "en-US,en;q=0.9,vi;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
            cookie: cookies,
        },
    });

    socket.on("open", () => {
        console.log(greenBold("✅ Kết nối tới WebSocket Boss server thành công"));
        socketBossCache[email] = socket;

        socket.send(JSON.stringify({
            type: "boss:list",
            payload: {}
        }));

        socket.send(JSON.stringify({
            type: "boss:check",
            payload: {}
        }));

        intervalPing[email] = setInterval(() => {
            socket.send(JSON.stringify({
                type: "ping",
                data: {}
            }));
            socket.send(JSON.stringify({
                type: "boss:list",
                payload: {}
            }));
        }, 15000);
    });


    socket.on("close", () => {
        console.log(redBold("❌ Boss socket bị đóng"));
        delete socketBossCache[email]
        delete intervalAttackBoss[email]
        delete intervalBossWorld[email]
        delete intervalPing[email]
        delete currentBossId[email]
        delete isLeaveAllBoss[email]
        clearInterval(intervalAttackBoss[email])
        clearInterval(intervalBossWorld[email])
        clearInterval(intervalPing[email])
        setTimeout(() => connectSocketBoss(props), 5100)
    });

    socket.on("message", (msg) => {
        try {
            if (socketBossCache[email]) {
                clearInterval(intervalBossWorld[email])
            }
            const data = JSON.parse(msg.toString());
            switch (data.type) {
                case "boss:list": {
                    handleBossWorld({
                        user: props.user,
                        email,
                        data,
                        socket: socket,
                    })
                    break;
                }
                case "boss:state": {
                    showDamageLog({ user: props.user, email, data })
                }
            }
        } catch {
        }
    });
}

function handleBossWorld(props) {
    const { user, socket, email, data } = props;

    console.log("")
    logWithTime(blueBold("Tên:") + " " + yellowBold(user?.name));
    logWithTime(blueBold("Cấp:") + " " + yellowBold(user?.level));
    logWithTime(blueBold("Thể lực:") + " " + yellowBold(user?.stamina?.toLocaleString()));


    if (timeoutCheck[email]) {
        clearTimeout(timeoutCheck[email])
    }

    timeoutCheck[email] = setTimeout(() => {
        socket.send(JSON.stringify({
            type: "boss:check",
            payload: {}
        }));
    }, [60 * 1000])


    const bossList = data?.payload || [];
    const now = new Date();

    // Leave all bosses once
    if (!isLeaveAllBoss[email]) {
        bossList.forEach(boss => {
            socket.send(JSON.stringify({
                type: "boss:leave",
                payload: { bossId: boss.id }
            }));
        });
        isLeaveAllBoss[email] = true;
    }

    const currentBoss = bossList.find(boss => boss.id === currentBossId[email]);

    // Check if the current boss is dead
    if (currentBoss) {
        const spawnTime = new Date(currentBoss.spawnedAt);
        const isDead = spawnTime > now || currentBoss.currentHp <= 0;

        if (isDead) {
            logLineBreak();
            logWithTime(blueBold(`Boss ${currentBoss.name} đã chết`));
            logLineBreak();

            currentBossId[email] = null;

            if (intervalAttackBoss[email]) {
                clearInterval(intervalAttackBoss[email]);
                intervalAttackBoss[email] = null;
            }
        } else {
            logLineBreak();
            const damLogUser = currentBoss?.damageLog?.find(item => item.userId == user?.userId);
            logWithTime(blueBold(`[${user?.name}] Bạn đã gây damage lên boss ${currentBoss.name} ${damLogUser?.damage?.toLocaleString() || 0}`));
            logWithTime(greenBold(`HP boss: ${currentBoss.currentHp?.toLocaleString()}`));
            logLineBreak();

        }
    }

    // If no boss selected, pick a new one
    if (!currentBossId[email]) {
        let newBoss = null;
        logLineBreak()
        for (let i = 0; i < 6
            ; i++) {
            const boss = bossList[i];
            const spawnTime = new Date(boss.spawnedAt);

            if (spawnTime < now && boss.currentHp > 0) {
                newBoss = boss;
                currentBossId[email] = boss.id;
                break;
            } else {
                const restTime = getRestTime(boss.spawnedAt)
                logWithTime(yellowBold(`[${user?.name}] Boss ${boss.name} hồi sinh sau ${restTime.minutes}:${restTime.seconds}`));
            }
        }


        if (newBoss) {
            logWithTime(redBold(`[${user?.name}] ⚔️ Bắt đầu tấn công boss ${newBoss.name}`));
            attackBoss({ socket, email, boss: newBoss, user });

            if (intervalAttackBoss[email]) {
                clearInterval(intervalAttackBoss[email]);
            }

            // ⏱️ Attack every 5 seconds
            intervalAttackBoss[email] = setInterval(() => {
                const boss = bossList.find(b => b.id === currentBossId[email]);
                if (!boss) return;

                const spawnTime = new Date(boss.spawnedAt);
                const isDead = spawnTime > new Date() || boss.currentHp <= 0;

                if (isDead) {
                    logLineBreak();
                    logWithTime(blueBold(`Boss ${boss.name} đã chết (from interval)`));
                    logLineBreak();

                    currentBossId[email] = null;
                    clearInterval(intervalAttackBoss[email]);
                    intervalAttackBoss[email] = null;
                    return;
                }

                attackBoss({ socket, email, boss, user });
            }, 5000); // 5s interval
        }
    }
}


function attackBoss({ socket, email, boss, user }) {
    try {
        const now = Date.now();
        if (lastAttackTime[email] && now - lastAttackTime[email] < 1000) {
            return;
        }

        lastAttackTime[email] = now;
        logLineBreak();
        logWithTime(redBold(`[${user?.name}] ⚔️ Tiếp tục tấn công boss ${boss.name}`));
        logLineBreak();

        socket.send(JSON.stringify({
            type: "boss:attack",
            payload: { bossId: boss.id }
        }));
    } catch (error) {
        console.log("🚀 ~ attackBoss ~ error:", error);
    }
}
