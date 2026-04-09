import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loginAndGetInfo(accountIndex = 0) {
    const configPath = path.resolve(__dirname, '../data/config.json');
    const dataPath = path.resolve(__dirname, '../data/data.json');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let dataArray = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    if (!Array.isArray(dataArray)) {
        dataArray = [dataArray];
    }

    const userData = dataArray[accountIndex];
    if (!userData) throw new Error(`Không tìm thấy tài khoản index ${accountIndex}`);

    // 1. Đăng nhập
    const authRes = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'apikey': config.API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: userData.email,
            password: userData.password,
            gotrue_meta_security: { captcha_token: null },
        }),
    });

    const authData = await authRes.json();
    if (!authRes.ok) throw new Error(`Đăng nhập thất bại (${userData.email})`);

    const token = authData.access_token;

    // 2. Lấy Character ID
    const charRes = await fetch(`${config.SUPABASE_URL}/rest/v1/characters?select=id,name&limit=1`, {
        headers: {
            'apikey': config.API_KEY,
            'Authorization': `Bearer ${token}`,
        }
    });

    const charData = await charRes.json();
    const charId = charData[0].id;

    // 3. Lưu dữ liệu
    userData.access_token = token;
    userData.char_id = charId;
    fs.writeFileSync(dataPath, JSON.stringify(dataArray, null, 2));

    const map_code = userData.map_code || "starter_01";

    return { token, charId, config, map_code, userData };
}