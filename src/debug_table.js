import { loginAndGetInfo } from './login.js';

async function debugTable() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/secret_realms?code=eq.worldboss_lk&select=*`, {
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        const data = await res.json();
        console.log('TABLE REALMS STATUS:', JSON.stringify(data, null, 2));

    } catch (err) {
        console.error('Lỗi Debug:', err.message);
    }
}

debugTable();
