import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function checkAccountInfo() {
    try {
        const accountIndex = 0;
        const auth = await loginAndGetInfo(accountIndex);
        const { token, charId, config } = auth;

        console.log('--- Account Info ---');
        console.log('Character ID:', charId);

        console.log('\n--- Getting Status (Cultivation Tab) ---');
        const status = await tracker.getStatus(token, charId, config);
        console.log(JSON.stringify(status, null, 2));

        console.log('\n--- Getting Character Stats ---');
        const stats = await tracker.getCharacterStats(token, charId, config);
        console.log(JSON.stringify(stats, null, 2));

        console.log('\n--- Getting Inventory ---');
        const inventory = await tracker.listInventory(token, charId, config);
        const valuableItems = inventory.filter(i => i.qty > 0);
        console.table(valuableItems.map(i => ({ name: i.name_vi, code: i.code, qty: i.qty, type: i.item_type })));

    } catch (e) {
        console.error('Check Error:', e);
    }
}

checkAccountInfo();
