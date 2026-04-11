import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function debugInv() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        const fullInv = await tracker.rpcCall(token, charId, config, 'rpc_get_inventory', {
            p_character_id: charId
        });

        if (fullInv && fullInv.data) {
            console.log('Sample Item:', JSON.stringify(fullInv.data[0], null, 2));
            console.log('Total Items with instance_id:', fullInv.data.filter(i => i.instance_id).length);
        }

    } catch (e) {
        console.error('Debug Error:', e);
    }
}

debugInv();
