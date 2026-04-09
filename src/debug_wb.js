import { loginAndGetInfo } from './login.js';

async function debugWB() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        const statusRes = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_realm_by_code`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ 
                p_character_id: charId,
                p_realm_code: "worldboss_lk" 
            })
        });
        const data = await statusRes.json();
        console.log('API RESPONSE:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Lỗi Debug:', err.message);
    }
}

debugWB();
