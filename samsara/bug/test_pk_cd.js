import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function testPK() {
    const auth = await loginAndGetInfo(0);
    const { token, charId, config } = auth;
    
    // We need a targetId. We can just pass a dummy one, or check if we get attack_cooldown first.
    const targetId = '00000000-0000-0000-0000-000000000000';
    const realmId = '85e05a5a-8b80-496c-85a0-d7904037599d'; // random realm

    const startTime = Date.now();
    const res = await tracker.rpcCall(token, charId, config, 'rpc_attack_realm_player_v2', {
        p_character_id: charId,
        p_realm_id: realmId,
        p_target_character_id: targetId,
        p_skill_slot: 0
    });
    console.log("Response:", JSON.stringify(res, null, 2));
}

testPK();
