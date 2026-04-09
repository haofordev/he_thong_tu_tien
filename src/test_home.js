import { loginAndGetInfo } from './login.js';

async function checkHome() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        console.log('--- KIỂM TRA TRẠNG THÁI CHUNG (HOME SNAPSHOT) ---');
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_home_snapshot`, {
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
        console.log('Home Snapshot:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Lỗi Check Home:', err.message);
    }
}

checkHome();
