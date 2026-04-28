import { yellowBold, greenBold } from './utils.js';

export async function loginGetCookies(email, password) {
    console.log(yellowBold('=== [ĐĂNG NHẬP TÀI KHOẢN] ==='));

    if (!email || !password) {
        console.error('❌ Email hoặc mật khẩu không được để trống');
        return null;
    }

    try {
        const resp = await fetch('https://mongtutien.online/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const cookies = resp.headers.get('set-cookie');
        if (!cookies) {
            console.log('⚠️ Không nhận được cookies.');
            return null;
        }

        // Get character info
        const meResp = await fetch('https://mongtutien.online/api/character/me', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                cookie: cookies
            }
        });
        const meData = await meResp.json();
        console.log(greenBold('👤 Nhân vật:', meData?.character?.name || 'Unknown'));

        return {
            cookies,
            user: meData?.character
        };
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        return null;
    }
}


export const getUserProfile = async (cookies) => {

    // Get character info
    const meResp = await fetch(' https://mongtutien.online/api/character/me', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            cookie: cookies
        }
    });
    const meData = await meResp.json();
    return meData?.character
}