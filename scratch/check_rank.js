import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkRank() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Checking Sect Rank Leaderboard (Tight Range) ---');
        const res = await tracker.rpcCall(token, charId, config, 'rpc_sect_rank_leaderboard', {
            p_character_id: charId,
            p_min_level: 20,
            p_max_level: 30,
            p_limit: 10
        });
        
        if (res && res.data) {
           console.log('Leaderboard:', JSON.stringify(res.data, null, 2));
           console.log('Board Code:', res.board_code);
        } else {
            console.log('No leaderboard found:', JSON.stringify(res, null, 2));
        }

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkRank();
