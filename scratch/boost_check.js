import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function powerBoostCheck() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Quick Power Boost Verification ---');
        
        // 1. Check Linh Mach cost
        console.log('\n[1] Checking Linh Mach...');
        const stats = await tracker.getCharacterStats(token, charId, config);
        console.log(`Current Linh Mach Level: ${stats.linh_mach?.level || 0}`);
        
        // Try to upgrade once if they have stones
        if (auth.userData.spirit_stones > 100) {
            console.log('Attempting to upgrade Linh Mach...');
            const res = await tracker.rpcCall(token, charId, config, 'rpc_upgrade_linh_mach', { p_character_id: charId });
            console.log('Result:', JSON.stringify(res, null, 2));
        }

        // 2. Check Talents (Spirit Root)
        console.log('\n[2] Checking Talents...');
        const talent = await tracker.rpcCall(token, charId, config, 'rpc_get_talent_snapshot', { p_character_id: charId });
        console.log('Talent Data:', JSON.stringify(talent, null, 2));

        // 3. Check for better Cultivation Spots
        console.log('\n[3] Checking Cultivation Spots...');
        const status = await tracker.getStatus(token, charId, config);
        const spots = status.cultivation_spots?.spots || [];
        console.table(spots.map(s => ({ Name: s.name, Code: s.code, Bonus: `+${s.pct_add}%`, Capacity: `${s.occupants}/${s.capacity || 'Inf'}` })));

        // 4. Check for Equipment Upgrades
        console.log('\n[4] Equipment Instance check...');
        const inv = await tracker.listInventory(token, charId, config);
        const eqInstances = inv.filter(i => i.item_type === 'equipment' && i.instance_id);
        if (eqInstances.length > 0) {
            console.log(`Found ${eqInstances.length} equipment instances.`);
            // Show first 5
            console.table(eqInstances.slice(0, 5).map(i => ({ Name: i.name_vi, ID: i.instance_id, Stars: i.stars || 0 })));
        }

    } catch (e) {
        console.error('Boost Check Error:', e);
    }
}

powerBoostCheck();
