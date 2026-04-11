import { loginAndGetInfo } from '../src/login.js';
import * as tracker from '../src/track.js';

async function equipPuppet() {
    try {
        const auth = await loginAndGetInfo(0);
        const { token, charId, config } = auth;

        // 1. Lấy trạng thái nhân vật
        const status = await tracker.getStatus(token, charId, config);
        const puppetData = await tracker.rpcCall(token, charId, config, 'rpc_get_puppets', {
            p_character_id: charId
        });
        const activePuppet = puppetData?.puppets?.find(p => p.owned);
        if (!activePuppet) return;

        // Đồ nhân vật đang mặc nằm ở status.home.stats.equipment
        const charEquipment = status.home.stats.equipment || {};
        const charEquippedIds = Object.values(charEquipment).map(e => e.instance_id);

        console.log(`Đang xử lý Khôi lỗi: ${activePuppet.puppet_id}`);

        // 2. Lấy hành trang
        const invRaw = await tracker.rpcCall(token, charId, config, 'rpc_list_inventory', {
            p_character_id: charId
        });
        const inv = Array.isArray(invRaw) ? invRaw : Object.values(invRaw);
        
        const spareEquips = inv.filter(item => 
            item && 
            item.instance_id && 
            item.item_type === 'equipment' && 
            !charEquippedIds.includes(item.instance_id)
        );

        if (spareEquips.length === 0) {
            console.log('Không có trang bị thừa.');
            return;
        }

        console.log(`Tìm thấy ${spareEquips.length} món đồ thừa.`);

        const bestWeapon = spareEquips.filter(e => e.code.includes('weapon')).sort((a,b) => b.code.localeCompare(a.code))[0];
        const bestArmor = spareEquips.filter(e => e.code.includes('armor')).sort((a,b) => b.code.localeCompare(a.code))[0];

        if (bestWeapon) {
            console.log(`Mặc ${bestWeapon.code} cho Khôi lỗi...`);
            await tracker.rpcCall(token, charId, config, 'rpc_puppet_equip', {
                p_puppet_id: activePuppet.puppet_id,
                p_instance_id: bestWeapon.instance_id
            });
        }

        if (bestArmor) {
            console.log(`Mặc ${bestArmor.code} cho Khôi lỗi...`);
            await tracker.rpcCall(token, charId, config, 'rpc_puppet_equip', {
                p_puppet_id: activePuppet.puppet_id,
                p_instance_id: bestArmor.instance_id
            });
        }

        console.log('✅ Đã trang bị xong cho Khôi lỗi.');

    } catch (e) {
        console.error('Lỗi:', e.message);
    }
}

equipPuppet();
