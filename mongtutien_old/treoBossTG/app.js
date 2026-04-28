import { loginGetCookies } from "../login.js";
import { readAccountsJsonFile, yellowBold, redBold } from "../utils.js";
import { connectSocketBoss } from "./boss.js";

const fileName = process.argv[2];
const cookieCache = {}

if (!fileName) {
    console.error("❌ No filename provided. Usage: node app.js <filename>");
    process.exit(1);
}

async function connectSocket(props) {
    const { email, password } = props;

    let user = {};

    if (cookieCache[email]) {
        user = props.user || {};
        connectSocketBoss({ email, user, cookies: cookieCache[email] })
        return;
    }

    const data = await loginGetCookies(email, password);
    if (!data) {
        console.log(redBold(`❌ Không lấy được cookie cho ${email}, bỏ qua.`));
        return;
    }
    cookieCache[email] = data.cookies;
    user = data.user || {};
    connectSocketBoss({ email, user, cookies: cookieCache[email] })
}


async function attackBossAccount() {
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
        }, 5000 * index);
    });
}

attackBossAccount();
