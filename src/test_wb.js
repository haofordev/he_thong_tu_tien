import { loginAndGetInfo } from './login.js';

async function checkWorldBoss() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        console.log('--- KIỂM TRA NHẮC NHỞ HẰNG NGÀY (DAILY REMINDERS) ---');
        const reminderRes = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_daily_reminders`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        const reminderData = await reminderRes.json();
        console.log('Daily Reminders:', JSON.stringify(reminderData, null, 2));

        console.log('\n--- KIỂM TRA BẢNG XẾP HẠNG WORLD BOSS (WB) ---');
        const wbRes = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_wb_weekly_leaderboard`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        const wbData = await wbRes.json();
        console.log('WB Leaderboard:', JSON.stringify(wbData, null, 2));

    } catch (err) {
        console.error('Lỗi Check WB:', err.message);
    }
}

checkWorldBoss();
