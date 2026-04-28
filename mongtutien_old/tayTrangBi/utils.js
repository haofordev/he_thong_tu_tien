import * as fs from "fs/promises";
import path from "path";

export const statLabelMap = {
    atk: "Sát thương:",
    def: "Phòng thủ:",
    speed: "Tốc độ thân pháp:",
    critChance: "Chí mạng:",
    critDamage: "Công bạo kích:",
    atkPercent: "Tăng sát thương:",
    defPercent: "Tăng phòng thủ:",
    hpPercent: "Tăng sinh lực:",
    speedPercent: "Tăng Tốc độ:",
    allStatsPercent: "Toàn Bộ Chỉ Số",
    damageReduction: "Miễn Thương:",
    dodge: "Né tránh:",
    counter: "Phản đòn:",
    counterDamageBonus: "Sát thương phản đòn:",
    lifesteal: "Hút huyết:",
    antiLifesteal: "Kháng hút huyết:",
    antiCounterChance: "Né phản kích:",
    antiCritChance: "Kháng chí mạng:",
    antiCritDamage: "Miễn Thương bạo:",
    antiDodge: "Kháng né tránh:",
    multiHitChance: "Liên Kích:",
    antiMultiHitChance: "Kháng Liên Kích:",
    finalDamageBonus: "Chân Thương:",
    debuff_resist: "Kháng hiệu ứng:",
    flatDefensePenetration: "Phá Giáp:",
    regen: "Hồi phục sinh lực:",
    dropBoost: "Cơ duyên rơi vật phẩm:",
    cultivationBonus: "Tốc độ tu luyện:",
    spiritStoneBonus: "Thu hoạch linh thạch:",
    hp: "Sinh lực:"
};


async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
    }
}

export async function writeJsonAtomic(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        await ensureDir(dir);

        const tmpPath = `${filePath}.tmp.${Date.now()}`;
        const json = JSON.stringify(data, null, 2) + "\n";

        await fs.writeFile(tmpPath, json, "utf8");
        await fs.rename(tmpPath, filePath);
    } catch (error) {
        console.error(`❌ Lỗi khi ghi file JSON ${filePath}:`, error.message);
    }
}