import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginWithEmailPass } from '../src/login.js';
import * as tracker from '../src/track.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function autoRedeemAndClaim() {
    try {
        const clonePath = path.resolve(__dirname, './clone.txt');
        const codePath = path.resolve(__dirname, './code.txt');

        if (!fs.existsSync(clonePath) || !fs.existsSync(codePath)) {
            console.error('[LỖI] Thiếu file clone.txt hoặc code.txt');
            return;
        }

        const clones = fs.readFileSync(clonePath, 'utf8').split('\n').filter(l => l.trim());
        const codes = fs.readFileSync(codePath, 'utf8').split('\n').filter(l => l.trim());

        console.log(`[HỆ THỐNG] Bắt đầu xử lý ${clones.length} clone với ${codes.length} mã code...`);

        for (const line of clones) {
            const parts = line.split(':');
            if (parts.length < 2) continue;

            const email = parts[0].trim();
            const pass = parts[1].trim();

            try {
                console.log(`\n[ACC] Đang xử lý: ${email}...`);
                const auth = await loginWithEmailPass(email, pass);
                const { token, charId, config } = auth;

                // // 1. Nhập Giftcode
                // for (const code of codes) {
                //     const res = await tracker.rpcCall(token, charId, config, 'rpc_redeem_token_code', {
                //         p_code: code.trim()
                //     });
                //     if (res && res.ok) {
                //         console.log(`    > [CODE] ${code}: Thành công!`);
                //     } else {
                //         console.log(`    > [CODE] ${code}: Thất bại (${res?.reason || 'Đã dùng hoặc hết hạn'})`);
                //     }
                // }

                // 2. Kiểm tra túi đồ (Đề phòng quà cộng thẳng)
                const inventory = await tracker.listInventory(token, charId, config);
                if (inventory.length > 0) {
                    console.log(`    > [TÚI ĐỒ] Có ${inventory.length} loại vật phẩm.`);
                }

                // 3. Nhận thư (Sử dụng logic chuẩn từ auto_mail.js)
                console.log(`    > [MAIL] Đang quét hòm thư...`);
                const mails = await tracker.listMailbox(token, charId, config);

                if (Array.isArray(mails) && mails.length > 0) {
                    let count = 0;
                    for (const mail of mails) {
                        // Kiểm tra has_gift và gift_claimed
                        if (mail.has_gift && mail.gift_claimed === false) {
                            const claim = await tracker.claimMailGift(token, charId, config, mail.id);
                            if (claim && (claim.ok || claim.success)) {
                                console.log(`    > [MAIL] Đã nhận quà thư: ${mail.subject || mail.title || mail.id}`);
                                count++;
                            }
                        }
                    }
                    console.log(`    > [MAIL] Hoàn tất nhận ${count} thư quà.`);
                } else {
                    console.log(`    > [MAIL] Hòm thư trống.`);
                }

            } catch (err) {
                console.error(`    > [LỖI] Không xử lý được acc này: ${err.message}`);
            }

            // Nghỉ 1s giữa các acc
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('\n[HỆ THỐNG] Hoàn tất quét sạch Giftcode và Thư cho toàn bộ clone!');

    } catch (e) {
        console.error('[CRITICAL ERROR]', e.message);
    }
}

autoRedeemAndClaim();