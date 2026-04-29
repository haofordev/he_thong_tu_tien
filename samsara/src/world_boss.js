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
            const lbRes = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_wb_weekly_leaderboard`, {
                method: 'POST',
                headers: {
                    'apikey': config.API_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'content-profile': 'public',
                },
                body: JSON.stringify({ p_character_id: charId })
            }).then(r => r.json());
            
            return { 
                foundBoss: false, 
                myDmg: lbRes.my_damage || 0, 
                msg: `Đóng (${bossInfo?.open_time || '--'} - ${bossInfo?.close_time || '--'})`
            };
        }

        const realmCode = "worldboss_lk";
        const joinRes = await bicanh.joinSecretRealm(token, charId, config, realmCode);
        let foundBoss = false;
        let lastBossHP = bossInfo.boss_hp_current || 0;
        let accumulatedDmg = 0;

        // Lấy dmg ban đầu từ leaderboard
        const initialLB = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_wb_weekly_leaderboard`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'content-profile': 'public'
            },
            body: JSON.stringify({ p_character_id: charId })
        }).then(r => r.json());
        accumulatedDmg = initialLB.my_damage || 0;

        if (joinRes && joinRes.realm_id) {
            let stayInFight = true;
            let retryCount = 0;

            while (stayInFight) {
                const snapshot = await bicanh.getRealmSnapshot(token, charId, config, joinRes.realm_id);
                const aliveMobs = snapshot?.mobs?.filter(m => m && m.status === 'alive' && m.hp > 0) || [];
                let boss = aliveMobs.find(m => m.mob_kind === 'boss' || m.mob_kind === 'world_boss' || m.name.toLowerCase().includes('long thi'));

                if (!boss && aliveMobs.length > 0) boss = aliveMobs[0];

                if (boss) {
                    foundBoss = true;
                    const time = () => new Date().toLocaleTimeString();

                    // Kiểm tra Mana hiện tại để quyết định cách đánh
                    const status = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_character_resources_v2`, {
                        method: 'POST',
                        headers: { 'apikey': config.API_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ p_character_id: charId })
                    }).then(r => r.json());
                    
                    const currentMP = status?.mp || 0;
                    const useV1 = (currentMP <= 50);

                    const attack = await bicanh.attackMob(token, charId, config, joinRes.realm_id, boss.id, useV1);
                    
                    if (attack && attack.httpOk && (attack.ok || attack.damage !== undefined)) {
                        retryCount = 0;
                        lastBossHP = attack.mob_hp_after ?? lastBossHP;
                        accumulatedDmg += (attack.damage || 0);

                        if (onProgress) {
                            const mode = useV1 ? "[THƯỜNG]" : "[CHIÊU]";
                            onProgress(`[${time()}] ${mode} HP: ${lastBossHP.toLocaleString()} | Bạn gây: +${(attack.damage || 0).toLocaleString()} (Tổng: ${accumulatedDmg.toLocaleString()})`);
                        }
                        
                        if (lastBossHP <= 0 || (attack.ok === false && attack.reason === 'mob_dead')) {
                            stayInFight = false;
                        }
                        
                        const waitTime = (attack.atk_speed_sec ? attack.atk_speed_sec * 1000 : 5000) + 200;
                        await new Promise(r => setTimeout(r, waitTime));
                    } else {
                        if (attack?.reason === 'attack_cooldown') {
                            const waitSec = attack.remain_sec || 3;
                            await new Promise(r => setTimeout(r, (waitSec * 1000) + 200));
                        } else if (attack?.reason === 'not_joined' || attack?.reason === 'not_found') {
                            await bicanh.joinSecretRealm(token, charId, config, realmCode);
                            await new Promise(r => setTimeout(r, 2000));
                        } else {
                            retryCount++;
                            if (onProgress) onProgress(`[Tạm nghỉ] Lỗi: ${attack?.reason || '??'} (Thử lại ${retryCount}/5)`);
                            if (retryCount >= 5) stayInFight = false;
                            await new Promise(r => setTimeout(r, 5000));
                        }
                    }
                } else {
                    retryCount++;
                    if (onProgress) onProgress(`Không thấy Boss... (Thanh tra lần ${retryCount}/3)`);
                    if (retryCount >= 3) stayInFight = false;
                    await new Promise(r => setTimeout(r, 5000));
                }
            }
            await bicanh.leaveSecretRealm(token, charId, config, joinRes.realm_id);
        }

        const leaderboardFinal = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_wb_weekly_leaderboard`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'content-profile': 'public'
            },
            body: JSON.stringify({ p_character_id: charId })
        }).then(r => r.json());

        return { 
            foundBoss, 
            myDmg: leaderboardFinal.my_damage || 0, 
            myRank: leaderboardFinal.my_rank || 'Chưa có',
            msg: foundBoss ? "Săn xong!" : "Kết thúc đợt săn",
            bossHp: lastBossHP
        };
    } catch (e) {
        return { foundBoss: false, msg: `Lỗi: ${e.message.substring(0, 20)}` };
    }
}
