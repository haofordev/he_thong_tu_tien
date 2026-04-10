// src/farm.js
// Farming automation: harvest ready crops and plant Tu Linh Flower seeds.

import * as tracker from './track.js';

/**
 * Harvest a specific slot if a crop is ready.
 * @returns true if a harvest was performed.
 */
async function harvestSlot(token, charId, config, slot) {
    try {
        const res = await tracker.rpcCall(token, charId, config, 'rpc_harvest_crop_guarded', {
            p_character_id: charId,
            p_slot: slot,
        });
        // The RPC returns an object with a `ready` flag (true when harvested).
        if (res && res.ready) {
            console.log(`[NÔNG TRẠI] Đã thu hoạch ô ${slot}`);
            return true;
        }
    } catch (e) {
        // Silently ignore – some slots may be empty.
    }
    return false;
}

/**
 * Plant a seed into an empty slot.
 */
async function plantSlot(token, charId, config, slot, seedCode) {
    try {
        const res = await tracker.rpcCall(token, charId, config, 'rpc_plant_crop_guarded', {
            p_character_id: charId,
            p_slot: slot,
            p_seed_code: seedCode,
        });
        if (res && res.ok) {
            console.log(`[NÔNG TRẠI] Đã trồng ${seedCode} vào ô ${slot}`);
            return true;
        }
    } catch (e) {
        // ignore failures (e.g., not enough seeds)
    }
    return false;
}

/**
 * Main routine: iterate over slots, harvest if ready, then plant if empty.
 */
export async function harvestAndPlant(token, charId, config) {
    // First, get current inventory to know how many seeds we have.
    const inventory = await tracker.listInventory(token, charId, config);
    const seedItem = inventory.find(i => i.code === 'seed_lk_tu_linh_flower');
    const seedQty = seedItem ? seedItem.qty : 0;
    if (seedQty === 0) {
        console.log('[NÔNG TRẠI] Không còn seed Tu Linh Flower để trồng.');
        return;
    }

    // Assume slots 1‑10 (adjust if game uses a different range).
    for (let slot = 1; slot <= 10; slot++) {
        // Try harvest first.
        const harvested = await harvestSlot(token, charId, config, slot);
        // After harvest (or if slot was already empty) attempt planting.
        if (seedQty > 0) {
            await plantSlot(token, charId, config, slot, 'seed_lk_tu_linh_flower');
        }
    }
}
