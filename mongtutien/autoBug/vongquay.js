import { loginGetCookies } from "../login.js";
import { blueBold, domain, greenBold, logWithTime } from "../utils.js";

const spinLuckyWheel = async (cookieObj) => {
    const { cookie, user, email, password } = cookieObj;

    try {
        const res = await fetch(domain + "/api/lucky-wheel/spin", {
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "cookie": cookie,
                "Referer": domain
            },
            body: JSON.stringify({ useFree: false, count: 10 }),
            method: "POST"
        });

        const data = await res.json();

        if (res.status === 401 || data.statusCode === 401) {
            logWithTime(`[${user?.name}] Cookie expired, re-login...`);
            // Re-login to get new cookies
            const newData = await loginGetCookies(email, password);
            if (newData?.cookies) {
                // Update cookieObj and retry
                cookieObj.cookie = newData.cookies;
                cookieObj.user = newData.user || {};
                setTimeout(() => spinLuckyWheel(cookieObj), 0); // retry quickly after login
            } else {
                logWithTime(`[${email}] Failed to re-login`);
            }
            return;
        }

        logWithTime(blueBold(`[${user?.name}] `) + `Spin result: ` + greenBold(`${data.spiritStoneBalance?.toLocaleString()}`));
        setTimeout(() => spinLuckyWheel(cookieObj), 0); // normal spin interval

    } catch (err) {
        console.error(`[${user?.name}] Error spinning wheel:`, err);
        setTimeout(() => spinLuckyWheel(cookieObj), 0); // retry after 5s on error
    }
};

const runApp = async () => {
    const accounts = [
        {
            email: "thienhoa001@gmail.com",
            password: "MK112233",
        }
    ];

    for (const account of accounts) {
        try {
            const data = await loginGetCookies(account.email, account.password);
            if (data?.cookies) {
                const cookieObj = {
                    cookie: data.cookies,
                    user: data.user || {},
                    email: account.email,
                    password: account.password
                };
                spinLuckyWheel(cookieObj);
            } else {
                logWithTime(`Login failed for ${account.email}`);
            }
        } catch (err) {
            console.error(`Error logging in ${account.email}:`, err);
        }
    }
};

runApp();
