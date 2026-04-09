import { loginAndGetInfo } from './login.js';
import * as kyngo from './ky_ngo.js';

async function debugKyNgo() {
    try {
        const { token, charId, config } = await loginAndGetInfo();
        
        console.log('--- ĐANG ENTER KỲ NGỘ ---');
        await kyngo.enterKiNgo(token, charId, config);

        console.log('--- ĐANG TRIGGER KỲ NGỘ ---');
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_trigger_ki_ngo`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        const data = await res.json();
        console.log('Kết quả Trigger:', JSON.stringify(data, null, 2));

        console.log('--- LẤY LOG MỚI NHẤT ---');
        const log = await kyngo.getLatestLog(token, charId, config);
        console.log('Log:', log);

    } catch (err) {
        console.error('Lỗi Debug:', err.message);
    }
}

debugKyNgo();
