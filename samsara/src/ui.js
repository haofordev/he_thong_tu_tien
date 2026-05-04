import chalk from 'chalk';
import { state } from './state.js';

const WIDTH = 60;

function renderBar(percent, width = 20, color = chalk.yellow) {
    const p = parseFloat(percent) || 0;
    const filledLength = Math.max(0, Math.min(width, Math.round((width * p) / 100)));
    const emptyLength = Math.max(0, width - filledLength);
    return color("█".repeat(filledLength)) + chalk.gray("░".repeat(emptyLength));
}

function truncate(text, length) {
    if (!text) return "";
    return text.length > length ? text.substring(0, length - 3) + "..." : text;
}

function colorQuest(val) {
    if (!val || typeof val !== 'string') return val;
    const parts = val.split('/');
    if (parts.length !== 2) return val;
    const current = parseInt(parts[0]);
    const target = parseInt(parts[1]);
    if (current >= target && target > 0) return chalk.green(val);
    return val;
}

export function renderUI() {
    let output = "";
    const s = state;
    const msg = s.messages;

    const hpColor = s.hp < 1000 ? chalk.red.bold : (s.hp < 5000 ? chalk.hex('#FFA500') : chalk.green);
    const mpColor = s.mp < 50 ? chalk.red.bold : (s.mp < 150 ? chalk.yellow : chalk.blue);

    const divider = chalk.cyan(`${"═".repeat(WIDTH)}\n`);
    const top = chalk.cyan(`${"═".repeat(WIDTH)}\n`);
    const bottom = chalk.cyan(`${"═".repeat(WIDTH)}\n`);

    output += "\x1B[2J\x1B[H"; 
    output += top;

    // Header
    output += ` 👤 Đạo hữu: ${chalk.bold.white(s.charName)} (Acc ${s.accountIndex})\n`;
    output += divider;

    // Resources
    const hpStr = `${hpColor(s.hp.toString())} (Đan: ${s.inventory['pill_lk_hp'] || 0})`;
    const mpStr = `${mpColor(s.mp.toString())} (Đan: ${s.inventory['pill_lk_mp'] || 0})`;
    const tlStr = `${chalk.yellow(s.stamina.toString())} (Đan: ${s.inventory['pill_lk_sta'] || 0})`;
    const thStr = `${chalk.magenta(s.spirit.toString())} (Đan: ${s.inventory['pill_lk_spirit'] || 0})`;

    output += ` ❤️ HP: ${hpStr.padEnd(25)} 🔵 MP: ${mpStr.padEnd(25)}\n`;
    output += ` ⚡ TL: ${tlStr.padEnd(25)} 👻 TH: ${thStr.padEnd(25)}\n`;
    output += ` 💰 Linh thạch: ${chalk.white(s.spiritStones.toLocaleString())}\n`;
    output += divider;

    // EXP & Kỳ Ngộ
    output += ` EXP: [${renderBar(s.exp.percent, 25)}] ${chalk.yellow(s.exp.percent + "%")}\n`;
    output += ` ${chalk.bold.hex('#00FFFF')('[KỲ NGỘ]:')} ${chalk.gray(truncate(msg.latest, WIDTH - 12))}\n`;
    output += divider;

    // Combat
    output += chalk.bold.white(` ⚔️  CHIẾN ĐẤU\n`);
    output += chalk.gray(`  → ${msg.boss}\n`);
    s.combatLogs.slice(0, 3).forEach(log => {
        output += chalk.gray(`    ${log}\n`);
    });
    output += divider;

    // Ranking
    output += chalk.bold.white(` 🏆 BXH: Hạng ${s.ranking.rank} | Điểm: ${s.ranking.score.toLocaleString()}\n`);
    output += chalk.gray(`  → Thua Hạng tiếp theo: ${s.ranking.gapNext.toLocaleString()}\n`);
    output += chalk.gray(`  → Thua Top 1: ${s.ranking.gapTop.toLocaleString()}\n`);
    output += divider;

    // Quest
    output += chalk.bold.white(` 🎯 Nhiệm vụ (Hạng: ${s.quest.rank})\n`);
    output += `  → Lv: ${colorQuest(s.quest.level)} | Quái: ${colorQuest(s.quest.mobs)}\n`;
    output += `  → Elite: ${colorQuest(s.quest.elite)} | Boss: ${colorQuest(s.quest.boss)}\n`;
    output += `  → PVP: ${colorQuest(s.quest.pvp)} | Chế tạo: ${colorQuest(s.quest.craft)}\n`;
    output += divider;

    // AFK
    output += ` 💤 AFK: ${chalk.green(msg.afk)}\n`;

    output += bottom;
    output += chalk.gray(` Cập nhật: ${new Date().toLocaleTimeString()} | Map: ${s.activeMapCode}\n`);

    process.stdout.write(output);
}
