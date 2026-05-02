// Dùng fetch global của Node.js v18+

/**
 * Vào bí cảnh
 */
export async function joinSecretRealm(token, charId, config, mapCode) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_join_secret_realm`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_code: mapCode
            })
        });
        const data = await res.json();
        return data; // { realm_id, message, ok }
    } catch (e) {
        console.error('[JOIN REALM ERROR]', e.message);
    }
    return null;
}

/**
 * Nhận thưởng AFK Bí cảnh
 */
export async function claimSecretRealmOfflineAFK(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_claim_offline_afk`, {
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
        const data = await res.json();
        return data;
    } catch (e) {
        console.error('[AFK REALM ERROR]', e.message);
    }
    return null;
}


/**
 * Quét Snapshot Bí Cảnh (Các thực thể trên bản đồ)
 */
export async function getRealmSnapshot(token, charId, config, realmId) {
    if (!realmId) return { mobs: [] };
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_secret_realm_snapshot`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_id: realmId,
                p_limit_players: 200
            })
        });
        const data = await res.json();
        return data;
    } catch (e) {
        console.error('[SNAPSHOT ERROR]', e.message);
    }
    return null;
}

export async function attackMob(token, charId, config, realmId, mobId) {
    try {
        const rpcName = 'rpc_attack_realm_mob_v3';

        const payload = {
            p_character_id: charId,
            p_realm_id: realmId,
            p_mob_id: mobId,
            p_skill_slot: 0,
            p_apply_counter: false // Mặc định là false theo logic game
        };

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

        const text = await res.text();
        let data = {};
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error(`[ATTACK MOB] Lỗi parse JSON (Status ${res.status}): ${text.substring(0, 100)}`);
            return { ok: false, httpOk: res.ok, message: `Lỗi Server (${res.status})` };
        }

        return { ...data, httpOk: res.ok, status: res.status };
    } catch (e) {
        console.error('[ATTACK MOB ERROR]', e.message);
        return { ok: false, httpOk: false, message: `Lỗi kết nối: ${e.message}` };
    }
}

/**
 * Tìm mục tiêu tối ưu từ Snapshot Bí Cảnh
 */
export function findNewTarget(snapshot, charId, blockedMobId = null) {
    if (!snapshot || !snapshot.mobs || !Array.isArray(snapshot.mobs) || snapshot.mobs.length === 0) {
        return { id: null, totalMobs: 0 };
    }

    const me = snapshot.participants?.find(p => p.character_id === charId)
        || snapshot.top_players?.find(p => p.character_id === charId)
        || snapshot.top_damage?.find(p => p.character_id === charId);

    const myX = me ? me.x : (snapshot.realm?.spawn_x_px || 1000);
    const myY = me ? me.y : (snapshot.realm?.spawn_y_px || 1000);

    // Lọc rộng hơn: chỉ cần có máu > 0
    const aliveMobs = snapshot.mobs.filter(m => m && (m.hp > 0 || m.status === 'alive'));
    const totalCount = aliveMobs.length;

    if (totalCount === 0) return { id: null, totalMobs: 0 };

    aliveMobs.forEach(m => {
        m.distance = Math.sqrt(Math.pow(myX - m.x, 2) + Math.pow(myY - m.y, 2));
        m.inRange = true;
    });

    // Ưu tiên Boss > Elite > Normal
    const bossMobs = aliveMobs.filter(m => m.mob_kind === 'boss').sort((a, b) => a.distance - b.distance);
    if (bossMobs.length > 0) {
        const target = bossMobs[0];
        return { id: target.id, inRange: true, distance: target.distance, mobKind: 'boss', hp: target.hp, totalMobs: totalCount };
    }

    const eliteMobs = aliveMobs.filter(m => m.mob_kind === 'elite').sort((a, b) => a.distance - b.distance);
    if (eliteMobs.length > 0) {
        const target = eliteMobs[0];
        return { id: target.id, inRange: true, distance: target.distance, mobKind: 'elite', hp: target.hp, totalMobs: totalCount };
    }

    const target = aliveMobs.sort((a, b) => a.distance - b.distance)[0];
    return { id: target.id, inRange: true, distance: target.distance, mobKind: target.mobKind || 'normal', hp: target.hp, totalMobs: totalCount };
}
