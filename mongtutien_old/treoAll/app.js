import {
    yellowBold,
    greenBold,
    redBold,
    readAccountsFromFile,
    readAccountsJsonFile,
    socketDomain,
} from '../utils.js';
import WebSocket from 'ws';
import { loginGetCookies } from '../login.js';
import { cleanupOnSocketClose, messageHandler } from './messageHandler.js';

const fileName = process.argv[2];
const isUsingCookie = process.argv[3];

if (!fileName) {
    console.error("❌ No filename provided. Usage: node app.js <filename>");
    process.exit(1);
}

const cookieCache = {};
const socketCache = {};
const pingInterval = {}; // store ping intervals
const reconnectAttempts = {}; // track reconnect attempts

function cleanupSocket(email) {
    delete socketCache[email];
    delete cookieCache[email];

    if (pingInterval[email]) {
        clearInterval(pingInterval[email]);
        delete pingInterval[email];
    }
}

function shouldReconnect(email) {
    reconnectAttempts[email] = (reconnectAttempts[email] || 0) + 1;
    if (reconnectAttempts[email] > 5) {
        console.log(redBold(`❌ Đã thử kết nối lại quá 5 lần. Dừng.`));
        return false;
    }
    return true;
}

async function connectSocket(props) {
    const { email, password } = props;

    let user = {};

    if (!cookieCache[email]) {
        const data = await loginGetCookies(email, password);
        if (!data) {
            console.log(redBold(`❌ Không lấy được cookie, bỏ qua.`));
            return;
        }
        cookieCache[email] = data.cookies;
        user = data.user || {};
    } else {
        user = Object.keys(user) == 0 ? props.user : user || {};
    }

    console.log("\n" + yellowBold(`=== [KẾT NỐI TỚI WEBSOCKET ===`));

    const socket = new WebSocket(socketDomain, {
        headers: {
            "accept-language": "en-US,en;q=0.9,vi;q=0.8",
            "cache-control": "no-cache",
            pragma: "no-cache",
            "cookie": cookieCache[email],
        },
    });


    socketCache[email] = socket;

    socket.on("open", () => {
        reconnectAttempts[email] = 0; // Reset retry count
        console.log(greenBold(`✅ Kết nối WebSocket thành công`));
    });

    socket.on("message", (message) => {
        try {
            const data = JSON.parse(message.toString());
            messageHandler({
                data,
                socket,
                user,
                ...props,
                reconnect: () => connectSocket(props),
            });
        } catch (err) {
            console.error(`❌ Lỗi xử lý message:`, err);
        }
    });

    socket.on("close", () => {
        console.log(redBold(`❌ Socket bị đóng — thử kết nối lại sau 5s...`));
        cleanupSocket(email);
        cleanupOnSocketClose(email);
        if (shouldReconnect(email)) {
            setTimeout(() => connectSocket(props), 5100);
        }
    });

    socket.on("error", (err) => {
        console.error(redBold(`❌ WebSocket error: ${err.message}`));
        cleanupSocket(email);
        if (shouldReconnect(email)) {
            setTimeout(() => connectSocket(props), 5100);
        }
    });
}

async function joinAllAction() {
    const accountsRaw = readAccountsJsonFile(fileName) || [];
    const accounts = Array.isArray(accountsRaw) ? accountsRaw : [accountsRaw];

    accounts.forEach((account, index) => {
        if (!account) return;
        setTimeout(() => {
            if (account.cookies) {
                cookieCache[account.email] = account.cookies;
            }
            console.log("\n================================================");
            console.log(yellowBold(`===== TÀI KHOẢN ${index + 1} =====`));
            connectSocket({ ...account });
        }, 1000 * index);
    });
}

joinAllAction();
