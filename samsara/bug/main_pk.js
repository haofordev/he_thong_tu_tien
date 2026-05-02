import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';
import * as bicanh from '../src/secret_realm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAP_CODE = "bf_tay_nam_c01";

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
        let liveTargetIds = []; // Danh sách các clone thực sự đang có mặt trong map

        const interval = setInterval(async () => {
            // Cứ mỗi 5 lần đánh hoặc khi liveTargetIds trống, quét lại snapshot một lần
            if (count % 5 === 0 || liveTargetIds.length === 0) {
                const snapshot = await bicanh.getRealmSnapshot(token, charId, config, realmId);
                const playersInMap = snapshot?.participants || snapshot?.top_players || [];
                const playerIdsInMap = new Set(playersInMap.map(p => p.character_id));

                // Chỉ giữ lại những ID clone nào thực sự đang đứng trong map
                liveTargetIds = targetIds.filter(id => playerIdsInMap.has(id));

                if (liveTargetIds.length === 0) {
                    process.stdout.write(`\r[MAIN] Đang đợi dàn clone xuất hiện trong map... (${new Date().toLocaleTimeString()})`);
                    return;
                } else {
                    console.log(`\n[MAIN] Phát hiện ${liveTargetIds.length} clone đang online. Bắt đầu PK...`);
                }
            }

            // Chọn mục tiêu từ danh sách "sống"
            const targetId = liveTargetIds[currentTargetIdx % liveTargetIds.length];
            if (!targetId) return;

            // Thực hiện PK - Dùng kỹ năng ô 1
            const res = await tracker.rpcCall(token, charId, config, 'rpc_attack_realm_player_v2', {
                p_character_id: charId,
                p_realm_id: realmId,
                p_target_character_id: targetId,
                p_skill_slot: 1
            });

            if (res && res.ok) {
                count++;
                console.log(`[PK] Lần ${count}: Đánh ${targetId.substring(0, 8)}... Dame: ${res.damage || 0}`);
                if (count >= 110) {
                    console.log('✅ Đã hoàn thành mục tiêu PK! Dừng máy.');
                    clearInterval(interval);
                    process.exit(0);
                }
                currentTargetIdx++;
            } else {
                const reason = res?.reason || res?.message || 'Lỗi';
                process.stdout.write(`\r[PK] Đang đợi... (${reason})`);

                // Nếu mục tiêu chết hoặc không tìm thấy, ép buộc quét lại ở lượt sau
                if (reason === 'target_is_dead' || reason === 'not_found' || reason === 'out_of_range') {
                    liveTargetIds = [];
                }
            }
        }, 2200);

    } catch (e) {
        console.error('[MAIN ERROR]', e.message);
    }
}

startPK();
