import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkRecipes() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        const res = await tracker.rpcCall(token, charId, config, 'rpc_list_recipes', {
            p_character_id: charId
        });
        
        console.log('--- All Recipes ---');
        if (res && Array.isArray(res)) {
            console.table(res.map(r => ({ Name: r.name_vi, Code: r.code })));
        } else {
            console.log('No recipes found or error:', res);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

checkRecipes();
