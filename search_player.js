import { loginAndGetInfo } from './src/login.js';
import * as bicanh from './src/secret_realm.js';

async function searchPlayer(targetName, targetId) {
    try {
        const { token, charId, config } = await loginAndGetInfo(0);
        console.log(`\n[HỆ THỐNG] Đang tìm kiếm nhân vật: ${targetName} [${targetId}]...`);

        const resRealms = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_list_secret_realms_today`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        const realmsData = await resRealms.json();
        const realmsArray = Array.isArray(realmsData) ? realmsData : (realmsData.realms || []);
        
        console.log(`[HỆ THỐNG] Đang quét qua ${realmsArray.length} map...`);

        for (const realm of realmsArray) {
            process.stdout.write(`\rĐang quét map: ${realm.realm_code}...          `);
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, realm.realm_id);
            
            if (snapshot && snapshot.characters) {
                const found = snapshot.characters.find(c => {
                    const cName = (c.name || c.character?.name || "").toLowerCase();
                    const cId = c.id || c.character_id;
                    return cId === targetId || cName.includes(targetName.toLowerCase());
                });
                
                if (found) {
                    console.log(`\n\n[!!!] ĐÃ TÌM THẤY MỤC TIÊU:`);
                    console.log(`- Nhân vật: ${targetName}`);
                    console.log(`- Map: ${realm.realm_code} (${realm.name || 'Bí Cảnh'})`);
                    console.log(`- Tọa độ: (${Math.round(found.x_px || found.x || 0)}, ${Math.round(found.y_px || found.y || 0)})`);
                    return;
                }
            }
        }
        console.log(`\n[HỆ THỐNG] Không thấy nhân vật này ở map nào.`);
    } catch (err) { console.error('\nLỗi:', err.message); }
}

searchPlayer('LỌ vương chí tôn', 'a98ab51c-b576-4179-8ee0-1e0244a6ca69');
searchPlayer('Bú Sục Công Công', 'd3bae508-b762-4333-afd7-72cdce1262de');
