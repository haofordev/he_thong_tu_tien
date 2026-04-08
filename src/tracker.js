import { loginAndGetInfo } from './login.js';

let latestKiNgo = "Đang kiểm tra nhật ký...";

// Hàm lấy log Kỳ Ngộ
async function getKiNgoLogs(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_ki_ngo_logs`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({ p_character_id: charId, p_limit: 1 })
        });

        const data = await res.json();

        // Sửa lại đoạn này để đọc từ data.logs
        if (res.ok && data.logs && data.logs.length > 0) {
            const log = data.logs[0];
            const time = new Date(log.created_at).toLocaleTimeString('vi-VN');

            // Map lại tên loại phần thưởng cho thuần việt (tùy chọn)
            let rewardType = log.reward_type;
            if (rewardType === 'spirit_stones') rewardType = 'Linh Thạch';
            if (rewardType === 'exp') rewardType = 'EXP';
            if (rewardType === 'pills') rewardType = 'Đan Dược';

            latestKiNgo = `[${time}] ${log.name_vi}: +${log.reward_amount} ${rewardType}`;
        } else {
            latestKiNgo = "Chưa tìm thấy nhật ký kỳ ngộ mới.";
        }
    } catch (e) {
        latestKiNgo = `Lỗi kết nối log: ${e.message}`;
    }
}

async function triggerKiNgo(token, charId, config) {
    try {
        const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_trigger_ki_ngo`, {
            method: 'POST',
            headers: {
                'apikey': config.API_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'x-client-info': 'supabase-flutter/2.12.0',
            },
            body: JSON.stringify({ p_character_id: charId })
        });

        // Đợi 2 giây sau khi trigger để server ghi log rồi mới lấy
        setTimeout(() => getKiNgoLogs(token, charId, config), 2000);
    } catch (e) {
        latestKiNgo = `Lỗi Trigger: ${e.message}`;
    }
}

async function startTracker() {
    try {
        const { token, charId, config } = await loginAndGetInfo();

        // Lấy log lần đầu tiên ngay khi vào game
        await getKiNgoLogs(token, charId, config);

        // Vòng lặp Dashboard (3s)
        setInterval(async () => {
            try {
                const res = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/rpc_get_cultivation_tab_snapshot`, {
                    method: 'POST',
                    headers: {
                        'apikey': config.API_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ p_character_id: charId, p_locale: "vi", p_log_limit: 1 })
                });

                const data = await res.json();
                if (!res.ok) return;

                const status = data.cultivation_status;
                const totalExp = status.cultivation_exp_progress + status.claimable_exp;

                console.clear();
                console.log(`===========================================================`);
                console.log(`   SAMSARA SUPREME TRACKER v3.1 (Fixed Log)                `);
                console.log(`===========================================================`);
                console.log(` Đạo hữu:    ${data.home.character.name}`);
                console.log(` Cảnh giới:  ${data.home.stats.base.realm_name}`);
                console.log(`-----------------------------------------------------------`);
                console.log(` EXP Hiện tại: ${status.cultivation_exp_progress} / ${status.exp_to_next}`);
                console.log(` EXP Chờ nhận: ${status.claimable_exp}`);
                console.log(` Tổng cộng:    ${totalExp} / ${status.exp_to_next}`);
                console.log(`-----------------------------------------------------------`);
                console.log(` [KỲ NGỘ MỚI NHẤT]:`);
                console.log(` > ${latestKiNgo}`);
                console.log(`-----------------------------------------------------------`);

                if (totalExp >= status.exp_to_next) {
                    console.log(` [!] CẢNH BÁO: ĐÃ ĐỦ EXP ĐỂ ĐỘT PHÁ!`);
                }

                console.log(` Cập nhật lúc: ${new Date().toLocaleTimeString()}`);
                console.log(`===========================================================`);
            } catch (e) { }
        }, 3000);

        // Vòng lặp Trigger Kỳ Ngộ (121s)
        triggerKiNgo(token, charId, config);
        setInterval(() => triggerKiNgo(token, charId, config), 121000);

    } catch (err) {
        console.error('[CRITICAL ERROR]', err.message);
    }
}

startTracker();