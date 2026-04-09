import * as bicanh from './secret_realm.js';

export async function manageWorldBoss(token, charId, config, onProgress) {
    try {
        if (onProgress) onProgress("Đang kiểm tra Boss...");
        
        const statusRes = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_realm_by_code`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ 
                p_character_id: charId,
                p_realm_code: "worldboss_lk" 
            })
        });
        const bossInfo = await statusRes.json();

        if (!bossInfo || bossInfo.ok === false) {
            return { foundBoss: false, msg: `Lỗi API: ${bossInfo?.message || 'Không xác định'}` };
        }

        if (!bossInfo.is_open || !bossInfo.can_join) {
            const leaderboard = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_wb_weekly_leaderboard`, {
                method: 'POST',
                headers: {
                    'apikey': config.API_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'content-profile': 'public',
                },
                body: JSON.stringify({ p_character_id: charId })
            }).then(res => res.json());
            
            return { 
                foundBoss: false, 
                myDmg: leaderboard.my_damage || 0, 
                myRank: leaderboard.my_rank || 'Chưa có',
                msg: `Đóng (${bossInfo?.open_time || '??:??'} - ${bossInfo?.close_time || '??:??'})`
            };
        }

        // 2. Vào vùng Boss
        const realmCode = "worldboss_lk";
        const joinRes = await bicanh.joinSecretRealm(token, charId, config, realmCode);
        let foundBoss = false;
        let lastBossHP = bossInfo.boss_hp_current;

        if (joinRes && joinRes.realm_id) {
            let stayInFight = true;
            while (stayInFight) {
                const snapshot = await bicanh.getRealmSnapshot(token, charId, config, joinRes.realm_id);
                const aliveMobs = snapshot?.mobs?.filter(m => m && m.status === 'alive' && m.hp > 0) || [];
                let boss = aliveMobs.find(m => 
                    m.mob_kind === 'boss' || m.mob_kind === 'world_boss' || m.mob_kind === 'elite' ||
                    m.name.toLowerCase().includes('long thi')
                );

                if (!boss && aliveMobs.length > 0) boss = aliveMobs[0];

                if (boss) {
                    foundBoss = true;
                    const time = () => new Date().toLocaleTimeString();
                    if (onProgress) onProgress(`[${time()}] Chiến đấu: ${boss.name}`);
                    
                    const attack = await bicanh.attackMob(token, charId, config, joinRes.realm_id, boss.id);
                    if (attack && attack.httpOk && (attack.ok || attack.damage !== undefined)) {
                        lastBossHP = attack.mob_hp_after ?? lastBossHP;
                        if (onProgress) onProgress(`[${time()}] Huyết: ${lastBossHP.toLocaleString()} HP`);
                        if (lastBossHP <= 0 || (attack.ok === false && attack.reason === 'mob_dead')) {
                            stayInFight = false;
                        }
                    } else {
                        if (attack?.reason === 'attack_cooldown') {
                            const waitSec = attack.remain_sec || 3;
                            await new Promise(r => setTimeout(r, (waitSec * 1000) + 200));
                            continue;
                        }
                        stayInFight = false;
                    }
                    await new Promise(r => setTimeout(r, 3200)); 
                } else {
                    stayInFight = false; // Không còn mục tiêu
                }
            }
            await bicanh.leaveSecretRealm(token, charId, config, joinRes.realm_id);
        }

        const leaderboardFinal = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_wb_weekly_leaderboard`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'content-profile': 'public',
            },
            body: JSON.stringify({ p_character_id: charId })
        }).then(res => res.json());

        return { 
            foundBoss, 
            myDmg: leaderboardFinal.my_damage || 0, 
            myRank: leaderboardFinal.my_rank || 'Chưa có',
            msg: foundBoss ? "Săn xong!" : "Mở nhưng không tìm thấy boss",
            bossHp: lastBossHP
        };
    } catch (e) {
        return { foundBoss: false, msg: `Lỗi: ${e.message.substring(0, 20)}` };
    }
}
