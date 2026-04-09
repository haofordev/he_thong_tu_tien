import { loginAndGetInfo } from './login.js';

async function checkDiscoveries() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        console.log('--- KIỂM TRA KHÁM PHÁ BÍ CẢNH (REALM DISCOVERIES) ---');
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_list_realm_discoveries`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        const data = await res.json();
        console.log('Discoveries:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Lỗi Check Discoveries:', err.message);
    }
}

checkDiscoveries();
