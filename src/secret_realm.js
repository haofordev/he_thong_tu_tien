/**
 * Tìm mục tiêu tối ưu từ Snapshot Bí Cảnh
 * Trả về { id, inRange, distance }
 */
export function findNewTarget(snapshot, charId, blockedMobId = null) {
    if (!snapshot || !snapshot.mobs || snapshot.mobs.length === 0) {
        return null;
    }

    const me = snapshot.participants?.find(p => p.character_id === charId)
        || snapshot.top_players?.find(p => p.character_id === charId)
        || snapshot.top_damage?.find(p => p.character_id === charId);

    const myX = me ? me.x : (snapshot.realm?.spawn_x_px || 1000);
    const myY = me ? me.y : (snapshot.realm?.spawn_y_px || 1000);
    const range = snapshot.realm?.skill_range_px || 300;
    const maxAttackDistance = range * 2.5; // Tối đa có thể di chuyển trong lúc attack (~750px nếu range=300px)

    const aliveMobs = snapshot.mobs.filter(m => m && m.status === 'alive' && m.hp > 0 && m.id !== blockedMobId);
    if (aliveMobs.length === 0) return null;

    aliveMobs.forEach(m => {
        m.distance = Math.sqrt(Math.pow(myX - m.x, 2) + Math.pow(myY - m.y, 2));
        m.inRange = m.distance <= range;
    });

    // CHIẾN THUẬT MỚI: Ưu tiên Boss > Elite > Normal
 
    // 1. Ưu tiên hàng đầu: BOSS
    const bossMobs = aliveMobs.filter(m => m.mob_kind === 'boss');
    if (bossMobs.length > 0) {
        bossMobs.sort((a, b) => a.distance - b.distance);
        const target = bossMobs[0];
        return { id: target.id, inRange: true, distance: target.distance, mobKind: 'boss', x: target.x, y: target.y, myX, myY };
    }
 
    // 2. Ưu tiên thứ hai: ELITE (Tinh anh)
    const eliteMobs = aliveMobs.filter(m => m.mob_kind === 'elite');
    if (eliteMobs.length > 0) {
        eliteMobs.sort((a, b) => a.distance - b.distance);
        const target = eliteMobs[0];
        return { id: target.id, inRange: true, distance: target.distance, mobKind: 'elite', x: target.x, y: target.y, myX, myY };
    }
 
    // 3. Cuối cùng mới là quái thường
    const normalMobs = aliveMobs.filter(m => m.mob_kind === 'normal');
    if (normalMobs.length > 0) {
        normalMobs.sort((a, b) => a.distance - b.distance);
        const target = normalMobs[0];
        return { id: target.id, inRange: true, distance: target.distance, mobKind: 'normal', x: target.x, y: target.y, myX, myY };
    }
 
    return null; // Map sạch quái -> Đổi map
}

/**
 * Chỉ tìm Boss hoặc Elite
 */
export function findOnlyBossElite(snapshot, charId) {
    if (!snapshot || !snapshot.mobs || snapshot.mobs.length === 0) return null;

    const me = snapshot.participants?.find(p => p.character_id === charId)
        || snapshot.top_players?.find(p => p.character_id === charId);

    const myX = me ? me.x : (snapshot.realm?.spawn_x_px || 1000);
    const myY = me ? me.y : (snapshot.realm?.spawn_y_px || 1000);
    const range = snapshot.realm?.skill_range_px || 300;

    const eliteMobs = snapshot.mobs.filter(m => m && m.status === 'alive' && m.hp > 0 && (m.mob_kind === 'boss' || m.mob_kind === 'elite'));
    if (eliteMobs.length === 0) return null;

    eliteMobs.forEach(m => {
        m.distance = Math.sqrt(Math.pow(myX - m.x, 2) + Math.pow(myY - m.y, 2));
        m.inRange = m.distance <= range;
    });

    // Ưu tiên con gần nhất
    eliteMobs.sort((a, b) => a.distance - b.distance);
    return { id: eliteMobs[0].id, inRange: eliteMobs[0].inRange, distance: eliteMobs[0].distance, mobKind: eliteMobs[0].mob_kind };
}

export async function joinSecretRealm(token, charId, config, realmCode = "train_lk_01") {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_join_secret_realm`, {
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
                p_realm_code: realmCode
            })
        });

        const data = await res.json();
        if (res.ok) {
            const actualData = Array.isArray(data) ? data[0] : data;
            return actualData;
        }
    } catch (e) {
        console.error('[BÍ CẢNH ERROR]', e.message);
    }
    return null;
}

export async function getRealmSnapshot(token, charId, config, realmId) {
    if (!realmId) return null;
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

/**
 * Tấn công quái
 * useV1 = true để đánh thường không tốn MANA (Dùng rpc_attack_realm_mob)
 * useV1 = false để dùng kỹ năng (Dùng rpc_attack_realm_mob_v2)
 */
export async function attackMob(token, charId, config, realmId, mobId, useV1 = false) {
    try {
        const rpcName = 'rpc_attack_realm_mob_v3';
        const payload = {
            p_character_id: charId,
            p_realm_id: realmId,
            p_mob_id: mobId
        };
        if (!useV1) payload.p_apply_counter = true;

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
        const actualData = Array.isArray(data) ? data[0] : data;

        return { ...actualData, httpOk: res.ok };
    } catch (e) {
        console.error('[ATTACK ERROR]', e.message);
    }
    return null;
}

export async function leaveSecretRealm(token, charId, config, realmId) {
    if (!realmId) return null;
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_leave_secret_realm`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_id: realmId
            })
        });
        const data = await res.json();
        return data;
    } catch (e) {
        console.error('[LEAVE REALM ERROR]', e.message);
    }
    return null;
}
