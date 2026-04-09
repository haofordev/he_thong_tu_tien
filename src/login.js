import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loginAndGetInfo() {
    const configPath = path.resolve(__dirname, '../data/config.json');
    const dataPath = path.resolve(__dirname, '../data/data.json');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let userData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

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
    if (!authRes.ok) throw new Error("Đăng nhập thất bại");

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
    fs.writeFileSync(dataPath, JSON.stringify(userData, null, 2));

    // QUAN TRỌNG: Phải có dòng return này
    return { token, charId, config };
}