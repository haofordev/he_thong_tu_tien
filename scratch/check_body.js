import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkBodyCultivation() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Body Cultivation Snapshot ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_get_body_cultivation', {
            p_character_id: charId
        });
        console.log(JSON.stringify(res, null, 2));

        // Let's also check for upgrade costs if available
        // Usually part of the snapshot or a separate lookup
    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkBodyCultivation();
