import { loginAndGetInfo } from '../src/login.js';

async function listInvFixed() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        console.log('--- Character Inventory (Table Query) ---');
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/character_inventory?character_id=eq.${charId}`, {
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Status:', res.status);
        const data = await res.json();
        
        if (Array.isArray(data)) {
            console.log('Total items:', data.length);
            const equips = data.filter(i => i.instance_id && !i.is_equipped);
            console.log('Spare items with instance_id:', equips.length);
            if (equips.length > 0) {
                console.log('Sample Spare:', JSON.stringify(equips[0], null, 2));
            }
        } else {
            console.log('Response is not an array:', JSON.stringify(data, null, 2));
        }

    } catch (e) {
        console.error('Check Error:', e);
    }
}

listInvFixed();
