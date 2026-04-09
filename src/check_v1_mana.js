import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';
import * as bicanh from './secret_realm.js';

async function checkV1Mana() {
    try {
        const { token, charId, config } = await loginAndGetInfo();
        const infoBefore = await tracker.getStatus(token, charId, config);
        const manaBefore = infoBefore.home.resources.mp;
        console.log(`Mana trước: ${manaBefore}`);

        const realmCode = "worldboss_lk";
        const joinRes = await bicanh.joinSecretRealm(token, charId, config, realmCode);
        const snapshot = await bicanh.getRealmSnapshot(token, charId, config, joinRes.realm_id);
        const boss = snapshot?.mobs?.find(m => m && m.status === 'alive');

        if (boss) {
            await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_attack_realm_mob`, {
                method: 'POST',
                headers: { 'apikey': config.API_KEY, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ p_character_id: charId, p_realm_id: joinRes.realm_id, p_mob_id: boss.id })
            });

            const infoAfter = await tracker.getStatus(token, charId, config);
            const manaAfter = infoAfter.home.resources.mp;
            console.log(`Mana sau: ${manaAfter}`);
        }
        await bicanh.leaveSecretRealm(token, charId, config, joinRes.realm_id);
    } catch (e) { console.error(e); }
}
checkV1Mana();
