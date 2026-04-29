export async function enterKiNgo(token, charId, config) {
    await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_ki_ngo_enter`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-client-info': 'supabase-flutter/2.12.0',
        },
        body: JSON.stringify({ p_character_id: charId })
    });
}

export async function getLatestLog(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_ki_ngo_logs`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ p_character_id: charId, p_limit: 1 })
        });
        const data = await res.json();
        if (res.ok && data.logs && data.logs.length > 0) {
            const log = data.logs[0];
            const time = new Date(log.created_at).toLocaleTimeString('vi-VN');
            return `[${time}] ${log.name_vi}: +${log.reward_amount} ${log.reward_type}`;
        }
    } catch (e) {
        return `Lỗi lấy log: ${e.message}`;
    }
    return "Chưa có nhật ký mới.";
}

export async function triggerKiNgo(token, charId, config) {
    await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_trigger_ki_ngo`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_character_id: charId })
    });
}