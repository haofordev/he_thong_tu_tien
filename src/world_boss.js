import * as bicanh from './secret_realm.js';

export async function manageWorldBoss(token, charId, config) {
    try {
        // 1. Kiểm tra trạng thái Boss qua rpc_get_realm_by_code
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
            return {
                foundBoss: false,
                msg: `Lỗi API: ${bossInfo?.message || 'Không xác định'}`
            };
        }

        if (!bossInfo.is_open || !bossInfo.can_join) {
            // Nếu không mở, kiểm tra bảng xếp hạng để lấy chỉ số cũ
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

        console.log(`[!] BOSS THẾ GIỚI ĐANG MỞ: ${bossInfo.name}`);
        console.log(`[!] Máu Boss: ${bossInfo.boss_hp_current} / ${bossInfo.boss_hp_max}`);

        // 2. Vào vùng Boss
        const realmCode = "worldboss_lk";
        const joinRes = await bicanh.joinSecretRealm(token, charId, config, realmCode);
        let foundBoss = false;
        let lastBossHP = bossInfo.boss_hp_current;

        if (joinRes && joinRes.realm_id) {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, joinRes.realm_id);
            
            if (snapshot && snapshot.mobs) {
                const boss = snapshot.mobs.find(m => 
                    m.kind === 'boss' || 
                    m.name.toLowerCase().includes('boss') || 
                    m.name.toLowerCase().includes('long thi')
                );

                if (boss) {
                    foundBoss = true;
                    // Tấn công liên tục cho đến khi boss chết hoặc hết thời gian
                    while (true) {
                        const attack = await bicanh.attackMob(token, charId, config, joinRes.realm_id, boss.id);
                        if (attack.httpOk && attack.ok) {
                            lastBossHP = attack.mob_hp_after;
                            console.log(`[WORLD BOSS] Gây: -${attack.damage || 0} HP. Boss còn: ${lastBossHP}`);
                            if (lastBossHP <= 0) break;
                        } else {
                            break;
                        }
                        await new Promise(r => setTimeout(r, 3200)); 
                    }
                }
            }
            // Sau khi đánh xong hoặc không thấy, rời đi
            await bicanh.leaveSecretRealm(token, charId, config, joinRes.realm_id);
        }

        // 3. Lấy lại rank sau khi đánh
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
            msg: foundBoss ? "Đang chiến đấu!" : "Mở nhưng không tìm thấy boss",
            bossHp: lastBossHP
        };

    } catch (e) {
        console.error(`[WORLD BOSS ERROR]`, e.message);
        return { foundBoss: false, msg: `Lỗi: ${e.message.substring(0, 20)}` };
    }
}
