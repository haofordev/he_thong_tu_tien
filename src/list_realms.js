import { loginAndGetInfo } from './login.js';

async function listOpenRealms() {
    try {
        const { token, charId, config } = await loginAndGetInfo();
        
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_list_secret_realms_v2`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId, p_locale: 'vi' })
        });
        const data = await res.json();
        console.log('--- RAW REALM DATA ---');
        console.log(JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Lỗi List Realms:', err.message);
    }
}

listOpenRealms();
