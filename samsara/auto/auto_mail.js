import { loginAndGetInfo, refreshTokenIfNeeded } from '../src/login.js';
import * as tracker from '../src/track.js';

let auth = {
    token: null,
    charId: null,
    config: null,
    accountIndex: 0,
    expiresAt: 0
};

async function manageMail() {
    const { token, charId, config } = auth;
    process.stdout.write(`\r[${new Date().toLocaleTimeString()}] [HỆ THỐNG] Đang kiểm tra hòm thư...`);
    try {
        const mails = await tracker.listMailbox(token, charId, config);

        // Theo dữ liệu thực tế, mails là một mảng trực tiếp
        if (!Array.isArray(mails) || mails.length === 0) {
            process.stdout.write(`\r[${new Date().toLocaleTimeString()}] [HỆ THỐNG] Hòm thư trống.                  \n`);
            return;
        }

        let count = 0;
        for (const mail of mails) {
            // 1. Nếu có quà và chưa nhận, thì nhận
            // Dữ liệu thực tế dùng 'gift_claimed' thay vì 'is_claimed'
            if (mail.has_gift && mail.gift_claimed === false) {
                const claim = await tracker.claimMailGift(token, charId, config, mail.id);
                if (claim && (claim.ok || claim.success)) {
                    console.log(`\n[HỆ THỐNG] Đã nhận quà từ thư: ${mail.subject || mail.title || mail.id}`);
                    count++;
                }
            }

            // 2. Đọc thư (nếu có thuộc tính is_read và chưa đọc)
            if (mail.is_read === false) {
                await tracker.readMail(token, charId, config, mail.id);
            }
        }

        if (count > 0) {
            console.log(`[HỆ THỐNG] Tổng cộng đã nhận ${count} thư có quà.`);
        }

        // 3. Xóa thư đã đọc (chỉ chạy nếu có ít nhất 1 thư)
        if (mails.length > 0) {
            await tracker.deleteReadMails(token, charId, config);
            process.stdout.write(`\r[${new Date().toLocaleTimeString()}] [HỆ THỐNG] Đã dọn dẹp thư.                   \n`);
        }
    } catch (e) {
        console.error(`\n[LỖI] Lỗi khi xử lý hòm thư:`, e.message);
    }
}

async function start() {
    try {
        const accountIndex = parseInt(process.argv[2] || "0");
        const loginData = await loginAndGetInfo(accountIndex);
        Object.assign(auth, loginData, { accountIndex });

        console.log(`=========================================`);
        console.log(` TỰ ĐỘNG NHẬN THƯ (STANDALONE)`);
        console.log(` Nhân vật: ${auth.userData.char_name || auth.charId}`);
        console.log(` Thời gian kiểm tra: Mỗi 10 phút`);
        console.log(`=========================================`);

        // Chạy lần đầu
        await manageMail();

        // Chạy định kỳ mỗi 10 phút
        setInterval(async () => {
            try {
                // Refresh token nếu cần
                const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
                if (newAuth) {
                    Object.assign(auth, newAuth);
                    console.log(`\n[HỆ THỐNG] Đã làm mới token.`);
                }
                await manageMail();
            } catch (e) {
                console.error(`\n[LỖI] Lỗi trong vòng lặp:`, e.message);
            }
        }, 600000);

    } catch (err) {
        console.error('[LỖI NGHIÊM TRỌNG]', err.message);
    }
}

start();
