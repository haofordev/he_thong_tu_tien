import { loginAndGetInfo } from './login.js';
import * as bicanh from './secret_realm.js';

async function testV1() {
    try {
        const { token, charId, config } = await loginAndGetInfo();
        const realmCode = "worldboss_lk";
        const joinRes = await bicanh.joinSecretRealm(token, charId, config, realmCode);

        if (joinRes && joinRes.realm_id) {
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, joinRes.realm_id);
            const aliveMobs = snapshot?.mobs?.filter(m => m && m.status === 'alive' && m.hp > 0) || [];
            let boss = aliveMobs.find(m => m.mob_kind === 'boss' || m.mob_kind === 'world_boss');

            if (boss) {
                console.log(`Thử với rpc_attack_realm_mob (v1)...`);
                const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_attack_realm_mob`, {
                    method: 'POST',
                    headers: {
                        'apikey': config.API_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        p_character_id: charId,
                        p_realm_id: joinRes.realm_id,
                        p_mob_id: boss.id
                    })
                });
                const data = await res.json();
                console.log('KẾT QUẢ V1:', JSON.stringify(data, null, 2));
            }
            await bicanh.leaveSecretRealm(token, charId, config, joinRes.realm_id);
        }
    } catch (err) { console.error(err); }
}

testV1();
