import { domain, log, colors, saveSession } from './utils.js';

export async function login(email, password) {
    log(`Đang đăng nhập: ${email}...`, colors.cyan);

    try {
        const response = await fetch(`${domain}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            signal: AbortSignal.timeout(30000) // 30s timeout
        });

        const data = await response.json();

        if (response.status !== 200 && response.status !== 201) {
            log(`Đăng nhập thất bại: ${data.message || response.statusText}`, colors.red);
            return null;
        }

        let cookies = "";
        if (response.headers.getSetCookie) {
            cookies = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
        } else {
            const rawCookies = response.headers.get('set-cookie');
            if (rawCookies) {
                // Basic fallback: if it's a comma-separated string from a standard fetch implementation
                cookies = rawCookies.split(',').map(c => c.split(';')[0].trim()).join('; ');
            }
        }
        
        // Fetch character info
        const meResponse = await fetch(`${domain}/api/character/me`, {
            headers: { 'cookie': cookies },
            signal: AbortSignal.timeout(15000) // 15s timeout
        });
        const meData = await meResponse.json();

        const session = {
            cookies,
            character: meData.character,
            name: meData.character?.name,
            token: data.token // If needed
        };

        saveSession(email, session);
        log(`Đăng nhập thành công! Nhân vật: ${meData.character?.name}`, colors.green);
        
        return session;
    } catch (error) {
        log(`Lỗi đăng nhập: ${error.message}`, colors.red);
        return null;
    }
}

export async function checkSession(session) {
    try {
        const response = await fetch(`${domain}/api/character/me`, {
            headers: { 'cookie': session.cookies },
            signal: AbortSignal.timeout(15000) // 15s timeout
        });
        return response.status === 200;
    } catch (error) {
        return false;
    }
}
