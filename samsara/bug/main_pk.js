import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';
import * as bicanh from '../src/secret_realm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_CODE = "train_lk_01";

async function startPK() {
    try {
        const accountIndex = 0; // Tài khoản chính
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log(`\n[MAIN] Đang vào Bí Cảnh để PK: ${auth.userData.char_name}`);

        // Vào bản đồ
        const realm = await bicanh.joinSecretRealm(token, charId, config, MAP_CODE);
        const realmId = realm?.realm_id;

        if (!realmId) {
            console.error('[MAIN] Không vào được Bí Cảnh!');
            return;
        }

        // Đọc danh sách ID từ clone.txt - Dùng Regex để tìm đúng UUID
        const clonePath = path.resolve(__dirname, '../bug/clone.txt');
        const content = fs.readFileSync(clonePath, 'utf8');
        const cloneLines = content.split('\n').filter(line => line.trim() !== '');

        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

        const targetIds = cloneLines.map(line => {
            const match = line.match(uuidRegex);
            return match ? match[0] : null;
        }).filter(id => id && id !== charId);

        if (targetIds.length === 0) {
            console.error('[MAIN] Không tìm thấy ID clone nào trong clone.txt!');
            return;
        }

        console.log(`[MAIN] Đã vào Instance: ${realmId}.`);
        console.log(`[MAIN] Danh sách mục tiêu (${targetIds.length}): ${targetIds.map(id => id.substring(0, 8)).join(', ')}`);

        let currentTargetIdx = 0;
        let count = 0;
        let failedAttempts = 0;

        while (count < 110) {
            const targetId = targetIds[currentTargetIdx % targetIds.length];

            // Thực hiện PK - Ưu tiên dùng Đánh Tay (slot 0) để ổn định
            const res = await tracker.rpcCall(token, charId, config, 'rpc_attack_realm_player_v2', {
                p_character_id: charId,
                p_realm_id: realmId,
                p_target_character_id: targetId,
                p_skill_slot: 0
            });

            if (res) {
                const reason = res.reason || res.message;

                // 1. Xử lý Hồi chiêu
                if (reason === 'attack_cooldown') {
                    const waitSec = (res.remain_sec || 1);
                    console.log(`    > [HỒI CHIÊU] Đợi ${waitSec}s...`);
                    await new Promise(r => setTimeout(r, waitSec * 1000));
                    continue;
                }

                // 2. Xử lý Mất dấu mục tiêu hoặc quá xa
                if (reason === 'target_not_found' || reason === 'not_found' || reason === 'target_is_dead' || reason === 'out_of_range') {
                    failedAttempts++;
                    currentTargetIdx++;
                    if (failedAttempts >= targetIds.length) {
                        process.stdout.write(`\r[MAIN] Đang đợi dàn clone xuất hiện trong map... (${new Date().toLocaleTimeString()})`);
                        await new Promise(r => setTimeout(r, 3000));
                        failedAttempts = 0;
                    } else {
                        // Thử clone tiếp theo nhanh hơn nếu clone này không có mặt
                        await new Promise(r => setTimeout(r, 200));
                    }
                    continue;
                }

                // 3. Xử lý Hết Mana
                if (reason === 'no_mana') {
                    console.log(`    > [HẾT MANA] Đang sử dụng thuốc MP...`);
                    await tracker.useItem(token, charId, config, 'pill_lk_mp');
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                // 4. Nếu có lỗi khác
                if (!res.ok && reason) {
                    console.log(`    > [LỖI PK] ${reason}`);
                    await new Promise(r => setTimeout(r, 1000));
                    currentTargetIdx++;
                    continue;
                }

                // 5. CHỈ KHI ĐẾN ĐÂY MỚI TÍNH LÀ 1 LẦN ĐÁNH HỢP LỆ
                count++;
                failedAttempts = 0; // Reset failed attempts since we hit someone
                const damage = res.damage || 0;
                console.log(`[PK] Lần ${count}: Đánh ${targetId.substring(0, 8)}... Dame: ${damage}`);
                
                if (damage === 0) {
                    console.log(`    > [GHI CHÚ] Dame 0 (Né tránh hoặc Bảo vệ).`);
                }

                currentTargetIdx++;
                await new Promise(r => setTimeout(r, 2200)); // Đợi delay mặc định của game
            } else {
                console.log(`\n[PK] Không có phản hồi từ server...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        console.log('✅ Đã hoàn thành mục tiêu PK! Dừng máy.');
        process.exit(0);

    } catch (e) {
        console.error('[MAIN ERROR]', e.message);
    }
}

startPK();
