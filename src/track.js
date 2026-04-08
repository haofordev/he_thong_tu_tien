export async function getStatus(token, charId, config) {
    const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_cultivation_tab_snapshot`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_character_id: charId, p_locale: "vi", p_log_limit: 1 })
    });
    return await res.json();
}

export async function claimExp(token, charId, config) {
    try {
        await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_claim_auto_cultivation_v4_v2`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
    } catch (e) {
        console.error('[CLAIM ERROR]', e.message);
    }
}