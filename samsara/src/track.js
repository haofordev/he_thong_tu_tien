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

export async function upgradeLinhMach(token, charId, config) {
    try {
        const res = await rpcCall(token, charId, config, 'rpc_upgrade_linh_mach', {
            p_character_id: charId
        });
        return res;
    } catch (e) {
        console.error('[UPGRADE LINH MACH ERROR]', e.message);
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

export async function getBodyCultivation(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_get_body_cultivation', { p_character_id: charId });
    } catch (e) {
        console.error('[GET BODY CULT ERROR]', e.message);
    }
    return null;
}

export async function claimBodyTraining(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_body_cult_claim_training', { p_character_id: charId });
    } catch (e) {
        console.error('[CLAIM BODY ERROR]', e.message);
    }
    return null;
}

export async function startBodyTraining(token, charId, config, element, sessionType = "long") {
    try {
        return await rpcCall(token, charId, config, 'rpc_body_cult_start_training', {
            p_character_id: charId,
            p_element: element,
            p_session_type: sessionType
        });
    } catch (e) {
        console.error('[START BODY ERROR]', e.message);
    }
    return null;
}

export async function upgradeBodyElement(token, charId, config, element) {
    try {
        return await rpcCall(token, charId, config, 'rpc_upgrade_body_element', {
            p_character_id: charId,
            p_element: element
        });
    } catch (e) {
    }
    return null;
}

export async function getArenaStatus(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_arena_get_status', { p_character_id: charId });
    } catch (e) {
        console.error('[GET ARENA ERROR]', e.message);
    }
    return null;
}

export async function collectArenaTribute(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_arena_collect_tribute', { p_character_id: charId });
    } catch (e) {
        console.error('[COLLECT ARENA ERROR]', e.message);
    }
    return null;
}

export async function findArenaOpponent(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_arena_find_opponent', { p_character_id: charId });
    } catch (e) {
        console.error('[FIND ARENA ERROR]', e.message);
    }
    return null;
}

export async function attackArenaOpponent(token, charId, config, defenderId, isNPC = false) {
    try {
        return await rpcCall(token, charId, config, 'rpc_arena_attack', {
            p_character_id: charId,
            p_defender_id: defenderId,
            p_is_npc: isNPC
        });
    } catch (e) {
        console.error('[ATTACK ARENA ERROR]', e.message);
    }
    return null;
}

export async function getArenaShop(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_arena_shop_list', { p_character_id: charId });
    } catch (e) {
        console.error('[GET ARENA SHOP ERROR]', e.message);
    }
    return null;
}

export async function buyArenaItem(token, charId, config, itemKey) {
    try {
        return await rpcCall(token, charId, config, 'rpc_arena_shop_buy', {
            p_character_id: charId,
            p_item_key: itemKey
        });
    } catch (e) {
        console.error('[BUY ARENA ITEM ERROR]', e.message);
    }
    return null;
}

export async function listFarmPlots(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_list_farm_plots', { p_character_id: charId });
    } catch (e) {
        console.error('[LIST FARM ERROR]', e.message);
    }
    return null;
}

export async function plantCrop(token, charId, config, slot, seedCode) {
    try {
        return await rpcCall(token, charId, config, 'rpc_plant_crop_guarded', {
            p_character_id: charId,
            p_slot: slot,
            p_seed_code: seedCode
        });
    } catch (e) {
        console.error('[PLANT CROP ERROR]', e.message);
    }
    return null;
}

export async function harvestCrop(token, charId, config, slot) {
    try {
        return await rpcCall(token, charId, config, 'rpc_harvest_crop_guarded', {
            p_character_id: charId,
            p_slot: slot
        });
    } catch (e) {
        console.error('[HARVEST CROP ERROR]', e.message);
    }
    return null;
}

export async function getWeeklyContestStatus(token, charId, config, type = "mob_kill") {
    try {
        return await rpcCall(token, charId, config, 'rpc_weekly_contest_get_status', {
            p_character_id: charId,
            p_contest_type: type
        });
    } catch (e) {
        console.error('[WEEKLY CONTEST ERROR]', e.message);
    }
    return null;
}

export async function listMailbox(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_list_mailbox`, {
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
                p_limit: 50,
                p_offset: 0
            })
        });
        return await res.json();
    } catch (e) {
        // ignore
    }
    return null;
}

export async function readMail(token, charId, config, mailId) {
    try {
        return await rpcCall(token, charId, config, 'rpc_read_mail', {
            p_character_id: charId,
            p_message_id: mailId
        });
    } catch (e) {
        // ignore
    }
    return null;
}

export async function claimMailGift(token, charId, config, mailId) {
    try {
        return await rpcCall(token, charId, config, 'rpc_claim_mail_gift_v2', {
            p_character_id: charId,
            p_message_id: mailId
        });
    } catch (e) {
        // ignore
    }
    return null;
}

export async function deleteReadMails(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_delete_read_mails', {
            p_character_id: charId
        });
    } catch (e) {
        // ignore
    }
    return null;
}

export async function getRebirthQuestProgress(token, charId, config) {
    try {
        return await rpcCall(token, charId, config, 'rpc_get_rebirth_quest_progress', { p_character_id: charId });
    } catch (e) {
        console.error('[REBIRTH PROGRESS ERROR]', e.message);
    }
    return null;
}

