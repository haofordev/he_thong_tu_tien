import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loginWithEmailPass } from '../src/login.js';
import * as bicanh from '../src/secret_realm.js';
import * as tracker from '../src/track.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startMultiClone() {
    try {
        const clonePath = path.resolve(__dirname, '../bug/clone.txt');
        let content = fs.readFileSync(clonePath, 'utf8');
        let lines = content.split('\n').filter(line => line.trim() !== '');

        console.log(`[HỆ THỐNG] Đang lọc danh sách ${lines.length} clone...`);

        const MAP_CODE = "train_lk_01";
        const successfulAccounts = [];
        const failedLines = new Set();

        let currentIndex = 0;
        while (successfulAccounts.length < 10 && currentIndex < lines.length) {
            const line = lines[currentIndex];
            const parts = line.split(':');

            if (parts.length < 2) {
                currentIndex++;
                continue;
            }

            const email = parts[0].trim();
            const pass = parts[1].trim();

            try {
                console.log(`[AUTH] [${currentIndex + 1}/${lines.length}] Đang thử: ${email}...`);
                const auth = await loginWithEmailPass(email, pass);
                const { token, charId, charName, config } = auth;

                console.log(`    > [OK] Nhân vật: ${charName} (ID: ${charId})`);

                const realm = await bicanh.joinSecretRealm(token, charId, config, MAP_CODE);
                if (realm && realm.realm_id) {
                    console.log(`    > [BÍ CẢNH] Đã vào Instance: ${realm.realm_id}`);
                    successfulAccounts.push(`${email}:${pass}:${charId}`);
                } else {
                    const errorMsg = realm?.message || realm?.reason || JSON.stringify(realm);
                    console.log(`    > [LỖI MAP] ${errorMsg}`);
                    // Vẫn lưu vào để tiếp tục dọn dẹp file clone.txt
                    successfulAccounts.push(`${email}:${pass}:${charId}`);
                }

                // Luôn khởi động giám sát để acc tự thử lại nếu lúc đầu lỗi
                monitorClone(token, charId, charName, config, MAP_CODE);

                await new Promise(r => setTimeout(r, 1500));
                if (successfulAccounts.length >= 10) {
                    currentIndex++;
                    break;
                }

            } catch (err) {
                if (err.message.includes('Đăng nhập thất bại')) {
                    console.error(`    > [XÓA] Sai tài khoản/mật khẩu: ${err.message}.`);
                    failedLines.add(line);
                } else {
                    console.error(`    > [BỎ QUA] ${err.message}. (Vẫn giữ trong danh sách)`);
                }
            }

            currentIndex++;
        }

        // Cập nhật lại file clone.txt
        const remainingLines = lines.slice(currentIndex).filter(l => !failedLines.has(l));
        const finalLines = [...successfulAccounts, ...remainingLines];
        fs.writeFileSync(clonePath, finalLines.join('\n') + '\n');

        // Bắt đầu vòng lặp Dashboard
        startDashboard();

    } catch (e) {
        console.error('[CRITICAL ERROR]', e.message);
    }
}

// Biến lưu trạng thái toàn cục
const clonesStatus = {};

function startDashboard() {
    setInterval(() => {
        console.clear();
        console.log(`====================================================================`);
        console.log(`   HỆ THỐNG GIÁM SÁT CLONE - ${new Date().toLocaleTimeString()}`);
        console.log(`====================================================================`);

        const statusList = Object.values(clonesStatus);
        statusList.forEach((s, i) => {
            const mapStatus = s.inMap ? "Trong BC" : "Ngoài BC";
            const mapId = (s.mapId || "None").substring(0, 8);
            const hpInfo = `(HP: ${s.hp}/${s.hpMax})`.padEnd(15);
            const pillInfo = `[Thuốc: ${s.pillCount || 0}]`.padEnd(15);
            const actionInfo = s.isHealing ? " [ĐANG HỒI MÁU...]" : "";
            const errorInfo = s.lastError ? ` {LỖI: ${s.lastError}}` : "";

            console.log(`acc ${i + 1} ${mapStatus.padEnd(10)} | Map: ${mapId.padEnd(8)} | ${hpInfo} | ${pillInfo}${actionInfo}${errorInfo}`);
        });

        if (statusList.length === 0) {
            console.log("   Đang khởi động dữ liệu...");
        }
        console.log(`====================================================================`);
    }, 3000);
}

/**
 * Vòng lặp giám sát cho từng acc
 */
async function monitorClone(token, charId, charName, config, mapCode) {
    // Khởi tạo trạng thái ban đầu
    clonesStatus[charId] = { name: charName, inMap: false, hp: 0, hpMax: 100, isHealing: false, pillCount: 0, lastError: "", mapId: "" };

    while (true) {
        try {
            // Quay lại dùng getStatus vì nó chứa HP/MP hiện tại chuẩn nhất
            const data = await tracker.getStatus(token, charId, config);
            const resources = data?.home?.resources || {};
            const hp = resources.hp || 0;
            const hpMax = resources.hp_max || 100;
            const character = data?.home?.character || {};
            const currentRealmId = character.realm_id;
            const currentMapId = character.map_id;

            // Cập nhật trạng thái
            clonesStatus[charId].hp = hp;
            clonesStatus[charId].hpMax = hpMax;
            clonesStatus[charId].inMap = !!currentRealmId;
            clonesStatus[charId].mapId = currentMapId || character.realm_code || "";
            clonesStatus[charId].lastError = "";

            // Log debug nếu HP vẫn 0 mặc dù đã cắn thuốc
            if (hp === 0 && clonesStatus[charId].pillUsed) {
                // console.log(`[DEBUG ${charName}] HP vẫn 0. Map: ${currentMapId}. Status:`, JSON.stringify(status));
            }

            // Luôn cập nhật số lượng thuốc để Dashboard hiển thị đúng
            const inventory = await tracker.listInventory(token, charId, config) || [];

            // Tìm thuốc hồi máu với bộ lọc cực mạnh
            const hpPill = inventory.find(item => {
                if (item.qty <= 0) return false;
                let effects = item.effects;
                if (typeof effects === 'string') {
                    try { effects = JSON.parse(effects); } catch (e) { }
                }
                const isHpCode = item.code.toLowerCase().includes('hp') || item.code.toLowerCase().includes('máu');
                const isHpName = item.name.toLowerCase().includes('hp') || item.name.toLowerCase().includes('máu');
                const hasHealEffect = (effects?.heal_hp > 0);
                return (hasHealEffect || isHpCode || isHpName || item.code === 'pill_lk_hp');
            });
            clonesStatus[charId].pillCount = hpPill ? hpPill.qty : 0;

            // 1. Tự động hồi máu và hồi sinh
            if (hp === 0) {
                clonesStatus[charId].isHealing = true;
                clonesStatus[charId].lastError = "Đang hồi sinh (về Tông Môn)...";

                // Rời Bí Cảnh
                await tracker.rpcCall(token, charId, config, 'rpc_leave_secret_realm', {
                    p_character_id: charId
                });
                await new Promise(r => setTimeout(r, 2000));

                // Gia nhập Tông Môn (Vùng an toàn để hồi sinh)
                const sectMap = "sect_lk_c01";
                await bicanh.joinSecretRealm(token, charId, config, sectMap);
                await new Promise(r => setTimeout(r, 3000));

                if (hpPill) {
                    const useRes = await tracker.useItem(token, charId, config, hpPill.code);
                    if (useRes && useRes.ok) {
                        clonesStatus[charId].lastError = "Đã hồi sinh tại Tông Môn!";
                    } else {
                        clonesStatus[charId].lastError = `Cắn thuốc lỗi: ${useRes?.reason || 'Unknown'}`;
                    }
                } else {
                    clonesStatus[charId].lastError = "Hết thuốc hồi sinh!";
                }
                clonesStatus[charId].isHealing = false;
            } else if (hp < hpMax * 0.8) {
                clonesStatus[charId].isHealing = true;
                if (hpPill) {
                    const useRes = await tracker.useItem(token, charId, config, hpPill.code);
                    if (useRes && !useRes.ok) {
                        clonesStatus[charId].lastError = `Hồi HP lỗi: ${useRes?.reason || 'Unknown'}`;
                    }
                    await new Promise(r => setTimeout(r, 1000));
                }
                clonesStatus[charId].isHealing = false;
            }

            // 2. Vào lại map nếu đang ở ngoài và có máu
            if (!clonesStatus[charId].inMap && hp > 0) {
                clonesStatus[charId].lastError = "Đang quay lại Bí Cảnh...";
                const realm = await bicanh.joinSecretRealm(token, charId, config, mapCode);
                if (realm && realm.realm_id) {
                    clonesStatus[charId].inMap = true;
                    clonesStatus[charId].lastError = "Đã vào map!";
                } else {
                    clonesStatus[charId].lastError = `Vào map lỗi: ${realm?.reason || 'Unknown'}`;
                }
            }

        } catch (e) {
            clonesStatus[charId].lastError = e.message;
        }

        await new Promise(r => setTimeout(r, 8000)); // Giãn cách 8s để tránh spam
    }
}

startMultiClone();
