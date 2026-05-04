import { rpcCall } from "track";

export async function getPuppets(token, charId, config) {
    try {
        return await rpcCall(
            token,
            charId,
            config,
            'rpc_get_puppets',
            { p_character_id: charId }
        );
    } catch (e) {
        console.error('[GET PUPPETS ERROR]', e.message);
    }
    return null;
}

export async function checkPuppetFarms(token, charId, config) {
    try {
        return await rpcCall(
            token,
            charId,
            config,
            'rpc_check_puppet_farms',
            { p_character_id: charId }
        );
    } catch (e) {
        console.error('[CHECK FARM ERROR]', e.message);
    }
    return null;
}

export async function claimPuppetFarm(token, charId, config, puppetId) {
    try {
        return await rpcCall(
            token,
            charId,
            config,
            'rpc_claim_puppet_farm',
            { p_puppet_id: puppetId }
        );
    } catch (e) {
        console.error('[CLAIM FARM ERROR]', e.message);
    }
    return null;
}

function startPuppetLoop() {
    let running = true;

    async function loop() {
        if (!running) return;

        try {
            const { token, charId, config } = auth;

            const res = await puppet.checkPuppetFarms(token, charId, config);

            if (!res?.sessions?.length) {
                state.puppet.status = 'No session';
                setTimeout(loop, 10000);
                return;
            }

            const session = res.sessions[0];

            const {
                puppet_id,
                finished,
                elapsed_sec,
                max_duration_sec
            } = session;

            // format time
            const timeStr = `${fmtTime(elapsed_sec)} / ${fmtTime(max_duration_sec)}`;

            state.puppet.time = timeStr;
            state.puppet.status = finished ? 'FINISHED' : 'FARMING';

            console.log(
                `[PUPPET] ${puppet_id.substring(0, 6)} | ${timeStr} | ${state.puppet.status}`
            );

            // ✅ FINISHED → CLAIM + RESTART
            if (finished) {
                console.log('[PUPPET] Claiming...');

                await puppet.claimPuppetFarm(token, charId, config, puppet_id);

                console.log('[PUPPET] Restart farm...');

                await puppet.startPuppetFarm(
                    token,
                    charId,
                    config,
                    puppet_id,
                    'sect_01_lk_c01' // TODO: dynamic nếu cần
                );
            }

        } catch (e) {
            console.log('[PUPPET ERROR]', e.message);
        }

        setTimeout(loop, 10000); // ⏱ 10s loop
    }

    loop();

    return () => {
        running = false;
    };
}