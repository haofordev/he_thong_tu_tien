import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkMissions() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Checking Sect Daily Missions ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_list_sect_daily_missions', {
            p_character_id: charId
        });
        
        if (res && res.data) {
           console.log(JSON.stringify(res.data, null, 2));
        } else {
            console.log('No missions found:', JSON.stringify(res, null, 2));
        }

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkMissions();
