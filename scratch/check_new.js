import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkNewFeatures() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Merit Medal Snapshot ---');
        const merit = await tracker.rpcCall(token, charId, config, 'rpc_get_merit_medal_snapshot', {
            p_character_id: charId
        });
        console.log(JSON.stringify(merit, null, 2));

        console.log('\n--- Statue Snapshot ---');
        const statue = await tracker.rpcCall(token, charId, config, 'rpc_get_statue_snapshot', {
            p_character_id: charId
        });
        console.log(JSON.stringify(statue, null, 2));

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkNewFeatures();
