import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkLinhMach() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Linh Mach Snapshot ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_get_linh_mach_snapshot', {
            p_character_id: charId
        });
        console.log(JSON.stringify(res, null, 2));

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkLinhMach();
