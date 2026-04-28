import { blueBold, redBold, yellowBold, logWithTime, mapPrices, getRestTime, replaceHTMLSystem, purpleBold, domain } from "./utils.js";

const timeoutResend = {}
const notRecieveExpTimes = {}

export async function autoTrain(props) {
    const { cookies, callback, user, email } = props

    if (!cookies) {
        console.log(redBold("Không nhận được cookie. Vui lòng nhập kiêm tra thông tin tài khoản"));
        return
    }

    const timeoutTick = user?.supremeRealmCard?.active ? 3900 : 4800

    try {

        const response = await fetch(`${domain}/api/explore/tick-v2`, {
            "headers": {
                "accept": "*/*",
                "accept-language": "vi-VN,vi;q=0.9,en-GB;q=0.8,en;q=0.7,fr-FR;q=0.6,fr;q=0.5,en-US;q=0.4",
                "priority": "u=1, i",
                "sec-ch-ua": "\"Not;A=Brand\";v=\"99\", \"Google Chrome\";v=\"139\", \"Chromium\";v=\"139\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "cookie": cookies,
                "Referer": domain
            },
            "body": null,
            "method": "GET"
        });

        let data = await response.json();

        clearTimeout(timeoutResend[email]);

        if (data.error) {
            if (data.statusCode == 401) {
                setTimeout(() => props.onError?.(), 5000);
                return
            } else if (data.statusCode == 429) {
                logWithTime(redBold(data.message))
            }

            timeoutResend[email] = setTimeout(() => autoTrain(props), timeoutTick);
        } else {
            if (data && data.state && Object.keys(data.state).length > 0) {
                console.log("")
                logResultExplore(data, props)
                if (!data.state.mapState || data.state.mapState.disabled) {
                    setTimeout(() => {
                        enterExplore(props)
                    }, 1000)
                }
                notRecieveExpTimes[email] = 0
            } else {
                notRecieveExpTimes[email] = (notRecieveExpTimes[email] || 0) + 1
                if (notRecieveExpTimes[email] > 5) {
                    console.log("")
                    logWithTime(redBold(`[${user?.name}] trong 30s không nhận được Exp vào lại BC sau 60s`));

                    setTimeout(() => {
                        enterExplore(props)
                        setTimeout(() => {
                            autoTrain(props)
                        }, 5000)
                    }, 1 * 60 * 1000)
                } else {
                    console.log("")
                    logWithTime(redBold(`[${user?.name}] không nhận được Exp`));
                    setTimeout(() => autoTrain(props), timeoutTick);
                }
                return
            }

            if (data && data.playersInMap && callback) {
                callback(data.playersInMap)
            }
            timeoutResend[email] = setTimeout(() => autoTrain(props), timeoutTick);
        }
    } catch (error) {
        clearTimeout(timeoutResend[email]);
        timeoutResend[email] = setTimeout(() => autoTrain(props), timeoutTick);
    }
}

function logResultExplore(data, props) {
    const { state, logs } = data;

    const { cookies, user, mainMap } = props

    if (!state && !logs) {
        console.log(redBold(`Không nhận được kết quả`));
        return;
    }

    if (state) {
        const restTime = getRestTime(state?.mapState?.endsAt || new Date());
        console.log(`====================[${state?.name || user?.name}]=========================`);
        logWithTime(blueBold("Map:") + " " + yellowBold(mapPrices[state?.mapState?.key]));
        logWithTime(blueBold("Linh thạch:") + " " + yellowBold(state?.spiritStone?.toLocaleString()));
        logWithTime(
            blueBold("Kinh nghiệm:") + " " +
            yellowBold(`${state.exp?.toLocaleString()}/${state.nextRealm?.exp?.toLocaleString()} (${((state.exp / state.nextRealm?.exp) * 100).toFixed(2)}%)`)
        );
        logWithTime(redBold(`Thời gian còn lại bí : ${restTime.hours}:${restTime.minutes}:${restTime.seconds}`));

        const endsAt = new Date(state.mapState.endsAt);
        const joinedAt = new Date(state.mapState.joinedAt);
        const now = new Date();

        const timeLeftMs = endsAt - now;
        const totalMapTimeMs = endsAt - joinedAt; // tổng thời gian map

        // 7 giờ = 7 * 60 * 60 * 1000 ms
        const sevenHoursMs = 7 * 60 * 60 * 1000;

        if (
            timeLeftMs > 0 &&
            timeLeftMs <= 0 * 60 * 1000 &&  // còn 55 phút
            totalMapTimeMs > sevenHoursMs    // tổng thời gian > 7 giờ
        ) {
            prepareForEnd(cookies, mainMap);
        }

    }

    if (logs) {
        logs.forEach(log => {
            if (log.type == "exp") {
                let text = replaceHTMLSystem.reduce(
                    (acc, item) => acc.replaceAll(item, ""),
                    log.text || ""
                );
                logWithTime(purpleBold(text));
            }
        });
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function prepareForEnd(cookies, mainMap) {
    console.log("⚡ Preparing for map end... Running leave/enter 30 times");

    for (let i = 0; i < 0; i++) {
        try {
            await leaveExplore(cookies);
            await sleep(100); // 500ms delay

            await enterEmtyExplore(cookies, mainMap); // No duration specified
            await sleep(100); // 500ms delay
        } catch (err) {
            console.error(`Error in leave/enter cycle ${i + 1}:`, err);
        }
    }
    await leaveExplore(cookies);
    console.log("✅ Finished 30 leave/enter cycles");
}


async function leaveExplore(cookies) {
    try {
        const res = await fetch(`${domain}/api/explore/leave`, {
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "cookie": cookies,
                "Referer": domain
            },
            method: "GET"
        });

        const data = await res.json();
        console.log("Leave Explore Response:", data);
        return data;
    } catch (err) {
        console.error("Leave Explore Error:", err);
    }
}

async function enterEmtyExplore(cookies, mainMap) {
    try {
        const res = await fetch(`${domain}/api/explore/enter`, {
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "cookie": cookies,
                "Referer": domain
            },
            body: JSON.stringify({
                key: mainMap,
            }),
            method: "POST"
        });

        const data = await res.json();
        console.log("Enter Explore Response:", data.mapState);
        return data;
    } catch (err) {
        console.error("Enter Explore Error:", err);
    }
}



export function enterExplore({ mainMap, cookies }) {
    fetch(`${domain}/api/explore/enter`, {
        headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "cookie": cookies,
            "Referer": domain
        },
        body: JSON.stringify({
            key: mainMap,
            duration: 8
        }),
        method: "POST"
    })
}
