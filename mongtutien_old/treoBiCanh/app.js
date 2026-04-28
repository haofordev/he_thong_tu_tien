import { loginGetCookies } from "../login.js"
import { autoTrain } from "../train.js"
import { readAccountsJsonFile } from '../utils.js';

const fileName = process.argv[2];

if (!fileName) {
    console.error("❌ No filename provided. Usage: node app.js <filename>");
    process.exit(1);
}

async function train() {
    const accountsRaw = readAccountsJsonFile(fileName) || [];
    const accounts = Array.isArray(accountsRaw) ? accountsRaw : [accountsRaw];

    accounts.forEach(async (account, index) => {
        if (!account) return;
        if (!account.cookies) {
            const data = await loginGetCookies(account.email, account.password) || {};
            if (data.cookies) {
                account.cookies = data.cookies
            }
            if (data.user) {
                account.user = data.user
            }
        }
        autoTrain({ ...account, onError: train });
    });
}

train()