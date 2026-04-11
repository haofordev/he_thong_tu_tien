import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';
import * as kyngo from '../src/ky_ngo.js';

async function diagnoseSpirit() {
    try {
        const accountIndex = parseInt(process.argv[2] || "0");
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log(`--- Diagnosing Spirit for: ${auth.userData.email} ---`);

        // 1. Get status and resources
        const status = await tracker.getStatus(token, charId, config);
        const resources = status?.home?.resources || {};
        const charInfo = status?.home?.character || {};
        
        console.log(`Current Spirit (Thần hồn): ${resources.spirit}`);
        console.log(`Current Stamina (Thể lực): ${resources.stamina}`);
        console.log(`Character Name: ${charInfo.name}`);

        // 2. Check Puppets
        const puppetsRes = await tracker.rpcCall(token, charId, config, 'rpc_get_puppets', {
            p_character_id: charId
        });
        console.log('\n--- Puppets Status ---');
        console.log(JSON.stringify(puppetsRes, null, 2));

        // 3. Check for any active tasks that might consume spirit
        if (status.qi_breakdown) {
            console.log('\n--- QI Breakdown ---');
            console.log(JSON.stringify(status.qi_breakdown, null, 2));
        }

        // 4. Check Inventory
        const inventory = await tracker.listInventory(token, charId, config);
        console.log('\n--- Inventory (Pills) ---');
        const pills = inventory.filter(i => i.code.startsWith('pill_lk_'));
        console.table(pills.map(i => ({ Name: i.name, Code: i.code, Qty: i.qty })));

        // 5. Check for any active "Kỳ Ngộ"
        const kiNgoLog = await kyngo.getLatestLog(token, charId, config);
        console.log('\n--- Latest Kỳ Ngộ Log ---');
        console.log(kiNgoLog);

    } catch (e) {
        console.error('Diagnosis Error:', e);
    }
}

diagnoseSpirit();
