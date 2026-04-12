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
        // API returns ok: true when successful, ok: false with message when failed
        if (res && res.ok) {
            console.log(`[NÔNG TRẠI] Thu hoạch thành công ô ${slot}`);
            return true;
        } else if (res && res.message) {
            // not_ready, slot_empty, etc. - skip silently in logs
            return false;
        }
    } catch (e) {
        console.log(`[NÔNG TRẠI] Lỗi thu hoạch ô ${slot}:`, e.message);
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
            console.log(`[NÔNG TRẠI] Trồng thành công ${seedCode} vào ô ${slot}`);
            return true;
        } else if (res && res.message) {
            return false;
        }
    } catch (e) {
        console.log(`[NÔNG TRẠI] Lỗi trồng ô ${slot}:`, e.message);
    }
    return false;
}

/**
 * Main routine: iterate over slots, harvest if ready, then plant if empty.
 */
export async function harvestAndPlant(token, charId, config) {
    // 1. First, try to harvest all slots.
    for (let slot = 1; slot <= 10; slot++) {
        await harvestSlot(token, charId, config, slot);
    }

    // 2. Then, check inventory for seeds to plant.
    const inventory = await tracker.listInventory(token, charId, config);
    const seedItem = inventory.find(i => i.code === 'seed_lk_tu_linh_flower');
    let seedQty = seedItem ? seedItem.qty : 0;

    if (seedQty === 0) {
        console.log('[NÔNG TRẠI] Không còn seed Tu Linh Flower để trồng.');
        return;
    }

    console.log(`[NÔNG TRẠI] Có ${seedQty} seed Tu Linh Flower sẵn sàng trồng`);

    // 3. Plant seeds in empty slots.
    let plantedCount = 0;
    for (let slot = 1; slot <= 10; slot++) {
        if (seedQty <= 0) break;
        const success = await plantSlot(token, charId, config, slot, 'seed_lk_tu_linh_flower');
        if (success) {
            seedQty--;
            plantedCount++;
        }
    }
    console.log(`[NÔNG TRẠI] Đã trồng xong ${plantedCount} ô`);
}
