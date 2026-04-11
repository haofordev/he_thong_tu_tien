import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkArena() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Checking Arena Status ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_arena_get_status', {
            p_character_id: charId
        });
        console.log(JSON.stringify(res, null, 2));

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkArena();
