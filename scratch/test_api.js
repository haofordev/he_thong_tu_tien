import { loginAndGetInfo } from '../src/login.js';
import * as bicanh from '../src/secret_realm.js';

async function testApi() {
    try {
        const accountIndex = 0;
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log('--- Testing joinSecretRealm ---');
        const realmData = await bicanh.joinSecretRealm(token, charId, config, 'train_lk_01');
        console.log('Join Result:', JSON.stringify(realmData, null, 2));

        if (realmData && realmData.realm_id) {
            console.log('--- Testing getRealmSnapshot ---');
            const snapshot = await bicanh.getRealmSnapshot(token, charId, config, realmData.realm_id);
            const target = bicanh.findNewTarget(snapshot, charId);
            
            if (target) {
                console.log('Target found:', target.id);
                console.log('--- Testing attackMob (Normal) ---');
                const resNormal = await bicanh.attackMob(token, charId, config, realmData.realm_id, target.id, true);
                console.log('Attack Normal Result:', JSON.stringify(resNormal, null, 2));

                const waitSec = resNormal.atk_speed_sec || 5;
                console.log(`Waiting for ${waitSec}s (from normal attack)...`);
                await new Promise(r => setTimeout(r, waitSec * 1000 + 500));

                console.log('--- Testing attackMob (Skill) ---');
                const resSkill = await bicanh.attackMob(token, charId, config, realmData.realm_id, target.id, false);
                console.log('Attack Skill Result:', JSON.stringify(resSkill, null, 2));
                
                const waitSecSkill = resSkill.atk_speed_sec || 5;
                console.log(`Waiting for ${waitSecSkill}s (from skill attack)...`);
                await new Promise(r => setTimeout(r, waitSecSkill * 1000 + 500));

                console.log('--- Testing attackMob (Normal 2nd) ---');
                const resNormal2 = await bicanh.attackMob(token, charId, config, realmData.realm_id, target.id, true);
                console.log('Attack Normal 2 Result:', JSON.stringify(resNormal2, null, 2));
            } else {
                console.log('No target found in snapshot.');
            }
        }
    } catch (e) {
        console.error('Test Error:', e);
    }
}

testApi();
