// check_dan.js
// Utility script to check inventory for "dan" items and optionally craft using rpc_craft_guarded.

import { loginAndGetInfo } from './login.js';
import * as tracker from './track.js';

/** Determine if an item is a "dan" (fabric) item */
function isDanItem(item) {
  const code = (item.code || '').toLowerCase();
  return code.includes('dan');
}

/** Send a craft request */
async function craftItem(token, charId, config, recipeCode, times = 1) {
  try {
    const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_craft_guarded`, {
      method: 'POST',
      headers: {
        apikey: config.API_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'content-profile': 'public',
        'x-client-info': 'supabase-flutter/2.12.0',
      },
      body: JSON.stringify({
        p_character_id: charId,
        p_recipe_code: recipeCode,
        p_times: times,
      }),
    });
    const data = await res.json();
    console.log('[CRAFT]', data);
    return data;
  } catch (e) {
    console.error('[CRAFT ERROR]', e.message);
    return null;
  }
}

/** Main function */
async function checkDan() {
  try {
    const { token, charId, config } = await loginAndGetInfo();
    const inventory = await tracker.listInventory(token, charId, config);
    if (!Array.isArray(inventory)) {
      console.error('Failed to retrieve inventory.');
      return;
    }
    const danItems = inventory.filter(isDanItem);
    console.log(`\n=== DAN INVENTORY (${danItems.length}) ===`);
    danItems.forEach(item => {
      const marker = item.code.toLowerCase().includes('dluyejen') ? ' <-- DLUYEJEN' : '';
      console.log(`- ${item.name} (${item.code}): ${item.qty}${marker}`);
    });
    const dluyejen = danItems.find(i => i.code.toLowerCase().includes('dluyejen'));
    if (dluyejen) {
      console.log('\nFound dluyejen variant, attempting to craft r_pill_lk_spirit...');
      await craftItem(token, charId, config, 'r_pill_lk_spirit', 1);
    } else {
      console.log('\nNo dluyejen variant found.');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkDan();
