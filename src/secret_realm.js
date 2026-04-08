/**
 * Tìm mục tiêu mới từ bản thám thính Bí Cảnh
 * @param {Object} snapshot - Dữ liệu trả về từ rpc_get_secret_realm_snapshot
 * @returns {String|null} mob_id của con quái còn sống hoặc null
 */
/**
 * Tìm mục tiêu tối ưu từ Snapshot Bí Cảnh
 */
export function findNewTarget(snapshot) {
    if (!snapshot || !snapshot.mobs || snapshot.mobs.length === 0) {
        return null;
    }

    // 1. Lọc ra danh sách quái vật thực sự còn sống (hp > 0 và status là alive)
    const aliveMobs = snapshot.mobs.filter(m => m.status === 'alive' && m.hp > 0);

    if (aliveMobs.length === 0) return null;

    // 2. Tìm Boss nếu có (thường boss có mob_kind là 'boss' hoặc 'elite')
    const boss = aliveMobs.find(m => m.mob_kind === 'boss' || m.mob_kind === 'elite');
    if (boss) return boss.id;

    // 3. Nếu không có Boss, sắp xếp quái thường theo HP tăng dần
    // Việc này giúp đạo hữu ưu tiên giết con quái sắp chết trước để lấy phần thưởng
    aliveMobs.sort((a, b) => a.hp - b.hp);

    return aliveMobs[0].id; // Trả về con quái yếu nhất đang sống
}


/**
 * Tham gia vào một Bí Cảnh dựa trên mã code (ví dụ: 'starter_01')
 */
export async function joinSecretRealm(token, charId, config, realmCode = "starter_01") {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_join_secret_realm`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_code: realmCode
            })
        });

        const data = await res.json();
        if (res.ok) {
            console.log(`[BÍ CẢNH] Đã tiến vào: ${realmCode}`);
            return data;
        }
        console.error('[BÍ CẢNH] Không thể vào Bí Cảnh:', data.message);
    } catch (e) {
        console.error('[BÍ CẢNH ERROR]', e.message);
    }
    return null;
}

/**
 * Thám thính tình hình Bí Cảnh (Snapshot)
 * Lấy danh sách quái vật và người chơi hiện tại
 */
export async function getRealmSnapshot(token, charId, config, realmId) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_secret_realm_snapshot`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_id: realmId,
                p_limit_players: 200
            })
        });
        return await res.json();
    } catch (e) {
        console.error('[SNAPSHOT ERROR]', e.message);
    }
    return null;
}

/**
 * Tấn công quái vật (Mob) trong Bí Cảnh
 */
export async function attackMob(token, charId, config, realmId, mobId) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_attack_realm_mob_v2`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({
                p_character_id: charId,
                p_realm_id: realmId,
                p_mob_id: mobId,
                p_apply_counter: true
            })
        });

        const data = await res.json();
        // Trả về toàn bộ data để main.js xử lý HP/MP sau đòn đánh
        if (res.ok) {
            return data;
        } else {
            console.error('[ATTACK FAILED]', data.message);
            return data;
        }
    } catch (e) {
        console.error('[ATTACK ERROR]', e.message);
    }
    return null;
}