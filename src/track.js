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

export async function getWallet(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_character_wallet`, {
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
        console.error('[WALLET ERROR]', e.message);
    }
    return null;
}

export async function checkOfflineAFK(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_check_offline_afk`, {
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
        console.error('[CHECK AFK ERROR]', e.message);
    }
    return null;
}

export async function claimOfflineAFK(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_claim_offline_afk`, {
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
        console.error('[CLAIM AFK ERROR]', e.message);
    }
    return null;
}

export async function startOfflineAFK(token, charId, config, realmCode = "starter_01") {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_start_offline_afk`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ 
                p_character_id: charId,
                p_realm_code: realmCode 
            })
        });
        return await res.json();
    } catch (e) {
        console.error('[START AFK ERROR]', e.message);
    }
    return null;
}

export async function openContainer(token, charId, config, itemCode, qty = 1) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_open_container_guarded`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_container_code: itemCode,
                p_qty: qty
            })
        });
        return await res.json();
    } catch (e) {
        console.error('[OPEN CHEST ERROR]', e.message);
    }
    return null;
}

export async function openAllContainers(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_open_all_containers`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId
            })
        });
        return await res.json();
    } catch (e) {
        console.error('[OPEN ALL CHESTS ERROR]', e.message);
    }
    return null;
}

export async function rpcCall(token, charId, config, rpcName, payload) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        return { ...data, ok: res.ok };
    } catch (e) {
        console.error(`[RPC ERROR ${rpcName}]`, e.message);
    }
    return null;
}

export async function craftPill(token, charId, config, recipeCode = "r_pill_lk_spirit") {
    try {
        const res = await rpcCall(token, charId, config, 'rpc_craft_guarded', {
            p_character_id: charId,
            p_recipe_code: recipeCode,
            p_times: 1
        });
        return res;
    } catch (e) {
        console.error('[CRAFT ERROR]', e.message);
    }
    return null;
}

export async function changeCultivationSpot(token, charId, config, spotCode) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_start_offline_afk`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_code: spotCode
            })
        });
        const data = await res.json();
        return { ...data, ok: res.ok };
    } catch (e) {
        console.error('[MOVE SPOT ERROR]', e.message);
    }
    return null;
}

export async function getCharacterResourcesV2(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_character_resources_v2`, {
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
        console.error('[GET RESOURCES V2 ERROR]', e.message);
    }
    return null;
}
