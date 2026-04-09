import { loginAndGetInfo } from './login.js';

async function testNH() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        console.log('--- KIỂM TRA NGOẠI HẢI (NH CITY OVERVIEW) ---');
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_nh_city_overview`, {
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
        console.log('NH Overview:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Lỗi Check NH:', err.message);
    }
}

testNH();
