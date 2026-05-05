import chalk from 'chalk';
import { loginAndGetInfo, refreshTokenIfNeeded } from '../src/login.js';
import * as tracker from '../src/track.js';

const TIME_RUN = 600;

async function luyenDanLoop() {
    const accountIndex = parseInt(process.argv[2] || "0");
    let auth = await loginAndGetInfo(accountIndex);

    const recipeCode = "r_talisman_lk_def";

    let time = 0;
    let successCount = 0;
    let failCount = 0;
    const startTime = Date.now();

    while (time < TIME_RUN) {
        try {
            const newAuth = await refreshTokenIfNeeded(auth.accountIndex, auth.expiresAt);
            if (newAuth) auth = { ...auth, ...newAuth };

            const res = await tracker.rpcCall(
                auth.token,
                auth.charId,
                auth.config,
                'rpc_craft_auto',
                {
                    p_character_id: auth.charId,
                    p_recipe_code: recipeCode,
                    p_times: 1
                }
            );

            if (res && res.success) {
                successCount++;
                time++;
            } else {
                failCount++;
                const errorMsg =
                    res?.message ||
                    res?.error_description ||
                    res?.error ||
                    "Unknown";

                if (
                    errorMsg.toLowerCase().includes("not_enough_items") ||
                    errorMsg.toLowerCase().includes("not_enough_spirit")
                ) {
                    renderDashboard({ time, successCount, failCount, total: TIME_RUN, email: auth.userData.email, startTime, stopped: true });
                    console.log(chalk.red("\n⛔ Dừng do thiếu nguyên liệu"));
                    break;
                }
            }

            renderDashboard({
                time,
                successCount,
                failCount,
                total: TIME_RUN,
                email: auth.userData.email,
                startTime
            });

        } catch (e) {
            failCount++;
        }

        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

function renderDashboard({ time, successCount, failCount, total, email, startTime, stopped }) {
    const totalRun = successCount + failCount;
    const successRate = totalRun > 0
        ? ((successCount / totalRun) * 100).toFixed(2)
        : 0;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const speed = totalRun > 0 ? (totalRun / elapsed).toFixed(2) : 0;

    // progress bar
    const percent = ((time / total) * 100).toFixed(1);
    const barLength = 30;
    const filled = Math.round((time / total) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    console.clear();

    console.log(chalk.magenta("==============================================="));
    console.log(chalk.bold.yellow("        🔥 LUYỆN ĐAN DASHBOARD 🔥"));
    console.log(chalk.magenta("==============================================="));

    console.log(chalk.cyan("⏱️  Tiến độ:   ") + chalk.green(`${time}/${total} (${percent}%)`));

    console.log(chalk.blue(`📊 [${bar}]`));

    console.log(chalk.gray("-----------------------------------------------"));

    console.log(chalk.green(`✅ Thành công: ${successCount}`));
    console.log(chalk.red(`❌ Thất bại:   ${failCount}`));
    console.log(
        chalk.yellow(`📈 Tỉ lệ:      ${successRate}%`)
    );

    console.log(chalk.gray("-----------------------------------------------"));

    console.log(chalk.blue(`⚡ Tốc độ: ${speed} lần/s`));
    console.log(chalk.blue(`⏳ Thời gian chạy: ${elapsed}s`));

    if (stopped) {
        console.log(chalk.bgRed.white("   STOPPED   "));
    }

    console.log(chalk.magenta("==============================================="));
}

luyenDanLoop().catch(err => {
    console.error(chalk.red('[CRITICAL ERROR]'), err);
});