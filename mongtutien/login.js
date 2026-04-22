import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CryptoJS from 'crypto-js';
import WebSocket from 'ws';

// ES Module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_PATH = path.join(__dirname, 'data.json');

// Load Config
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));

export class GameClient {
    constructor(accountIndex) {
        this.accountIndex = accountIndex;
        const data = this.loadData();
        const account = data.accounts[this.accountIndex];

        this.email = account.email;
        this.password = account.password;
        this.baseUrl = config.game.api_base;
        this.socketUrl = config.game.socket_url;
        this.headers = {
            'User-Agent': config.settings.user_agent,
            'Content-Type': 'application/json',
            'Referer': 'https://mongtutien.me/',
            'Origin': 'https://mongtutien.me'
        };
        this.session = account.session || {
            token: null,
            cookies: null,
            aesKey: null,
            iv: null,
            hmacKey: null
        };
        this.exploreSettings = account.explore || {
            key: "linh-coc",
            duration: 1
        };
        this.ws = null;
    }

    async enterExplore() {
        console.log(`[Explore] Entering ${this.exploreSettings.key}...`);
        try {
            const response = await axios.post(`${this.baseUrl}/explore/enter`, {
                key: this.exploreSettings.key,
                duration: this.exploreSettings.duration
            }, {
                headers: {
                    ...this.headers,
                    'Cookie': this.session.cookies?.join('; ')
                }
            });

            console.log(`[Explore] Success:`, response.data.message || 'Entered');
            return response.data;
        } catch (error) {
            console.error(`[Explore] Failed:`, error.response?.data || error.message);
            return null;
        }
    }

    loadData() {
        return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    }

    async login() {
        console.log(`[Auth] Attempting login for ${this.email}...`);
        try {
            const response = await axios.post(`${this.baseUrl}/auth/login`, {
                email: this.email,
                password: this.password
            }, {
                headers: this.headers
            });

            // Handle cookies (Nuxt usually uses cookie-based auth)
            this.session.cookies = response.headers['set-cookie'];
            this.session.token = response.data.token || null;

            console.log(`[Auth] Login successful!`);
            this.saveSession();
            return true;
        } catch (error) {
            console.error(`[Auth] Login failed:`, error.response?.data || error.message);
            return false;
        }
    }

    async verifyToken() {
        if (!this.session.cookies) return false;
        try {
            const response = await axios.get(`${this.baseUrl}/auth/verify`, {
                headers: {
                    ...this.headers,
                    'Cookie': this.session.cookies.join('; ')
                }
            });
            console.log(`[Auth] Token verified. Player: ${response.data.character?.name || 'Unknown'}`);
            return true;
        } catch (error) {
            console.warn(`[Auth] Token expired or invalid.`);
            return false;
        }
    }

    async refreshToken() {
        console.log(`[Auth] Refreshing token...`);
        return await this.login();
    }

    saveSession() {
        const data = this.loadData();
        data.accounts[this.accountIndex].session = this.session;
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    }

    loadSession() {
        const data = this.loadData();
        const account = data.accounts[this.accountIndex];
        if (account.session && account.session.token) {
            this.session = account.session;
            return true;
        }
        return false;
    }

    connectSocket() {
        console.log(`[Socket] Connecting to ${this.socketUrl}...`);
        this.ws = new WebSocket(this.socketUrl, {
            headers: {
                'User-Agent': this.headers['User-Agent'],
                'Cookie': this.session.cookies?.join('; ')
            }
        });

        this.ws.on('open', () => {
            console.log(`[Socket] Connected.`);
        });

        this.ws.on('message', (data) => {
            const message = data.toString();
            try {
                const parsed = JSON.parse(message);
                this.handleSocketMessage(parsed);
            } catch (e) {
                const decrypted = this.decryptMessage(message);
                if (decrypted) {
                    this.handleSocketMessage(decrypted);
                }
            }
        });

        this.ws.on('close', () => {
            console.log(`[Socket] Disconnected.`);
            setTimeout(() => this.connectSocket(), config.settings.reconnect_interval);
        });

        this.ws.on('error', (err) => {
            console.error(`[Socket] Error:`, err.message);
        });
    }

    handleSocketMessage(msg) {
        if (msg.type === 'sessionKey') {
            console.log(`[Socket] Handshake received. Setting encryption keys.`);
            this.session.aesKey = msg.payload.aesKey;
            this.session.iv = msg.payload.iv;
            this.session.hmacKey = msg.payload.hmacKey;
            this.saveSession();
        } else if (msg.type === 'force-logout') {
            console.warn(`[Socket] Forced logout received.`);
            this.refreshToken();
        } else {
            //console.log(`[Socket] Message:`, msg.type, msg.payload);
        }
    }

    encryptMessage(data) {
        if (!this.session.aesKey) return JSON.stringify(data);

        const timestamp = Date.now();
        const nonce = Math.random().toString(36).substring(7);
        const payload = JSON.stringify({ timestamp, nonce, data });

        const key = CryptoJS.enc.Base64.parse(this.session.aesKey);
        const iv = CryptoJS.enc.Base64.parse(this.session.iv);
        const hmacKey = CryptoJS.enc.Base64.parse(this.session.hmacKey);

        const encrypted = CryptoJS.AES.encrypt(payload, key, {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        }).toString();

        const signature = CryptoJS.HmacSHA256(encrypted + nonce + timestamp, hmacKey).toString();

        return JSON.stringify({
            ciphertext: encrypted,
            nonce: nonce,
            timestamp: timestamp,
            signature: signature
        });
    }

    decryptMessage(data) {
        if (!this.session.aesKey) return null;
        try {
            const { ciphertext, nonce, timestamp, signature } = JSON.parse(data);
            const hmacKey = CryptoJS.enc.Base64.parse(this.session.hmacKey);

            const expectedSig = CryptoJS.HmacSHA256(ciphertext + nonce + timestamp, hmacKey).toString();
            if (expectedSig !== signature) {
                console.error("[Socket] Invalid signature!");
                return null;
            }

            const key = CryptoJS.enc.Base64.parse(this.session.aesKey);
            const iv = CryptoJS.enc.Base64.parse(this.session.iv);

            const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }).toString(CryptoJS.enc.Utf8);

            return JSON.parse(decrypted).data;
        } catch (e) {
            return null;
        }
    }

    sendCommand(type, payload = {}) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const msg = this.encryptMessage({ type, payload });
            this.ws.send(msg);
        }
    }
}

// Main execution
(async () => {
    // We pass the index of the account we want to use from data.json
    const client = new GameClient(0);

    const hasSession = client.loadSession();
    let loggedIn = false;

    if (hasSession) {
        loggedIn = await client.verifyToken();
    }

    if (!loggedIn) {
        loggedIn = await client.login();
    }

    if (loggedIn) {
        client.connectSocket();

        setInterval(() => {
            client.sendCommand('state:get');
        }, 30000);
    }
})();
