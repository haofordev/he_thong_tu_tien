export async function getStatus(token, charId, config) {
    const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_cultivation_tab_snapshot`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'content-profile': 'public',
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
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
    } catch (e) {
        console.error('[CLAIM ERROR]', e.message);
    }
}

export async function doBreakthrough(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_breakthrough_v1`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        const data = await res.json();
        console.log(`[ĐỘT PHÁ] Kết quả: ${data.message || 'Thành công'}`);
        return data;
    } catch (e) {
        console.error('[BREAKTHROUGH ERROR]', e.message);
    }
    return null;
}

export async function getCharacterStats(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_character_stats`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId })
        });
        return await res.json();
    } catch (e) {
        console.error('[STATS ERROR]', e.message);
    }
    return null;
}

export async function useItem(token, charId, config, itemCode) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_use_item`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_item_code: itemCode
            })
        });
        const data = await res.json();
        return { ...data, ok: res.ok };
    } catch (e) {
        console.error('[USE ITEM ERROR]', e.message);
    }
    return null;
}

export async function listInventory(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_list_inventory`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_locale: "vi"
            })
        });
        return await res.json();
    } catch (e) {
        console.error('[INVENTORY ERROR]', e.message);
    }
    return null;
}