import { GameClient } from './login.js';

async function startExplore() {
    // Initialize client for the first account
    const client = new GameClient(0);

    // Ensure we are logged in
    const hasSession = client.loadSession();
    let loggedIn = false;

    if (hasSession) {
        loggedIn = await client.verifyToken();
    }

    if (!loggedIn) {
        loggedIn = await client.login();
    }

    if (!loggedIn) {
        console.error("[Explore] Could not login.");
        return;
    }

    // Connect socket to monitor EXP gain
    client.connectSocket();

    // Override or add specific message handler for EXP check
    const originalHandler = client.handleSocketMessage.bind(client);
    client.handleSocketMessage = (msg) => {
        originalHandler(msg);
        
        // Check for EXP gain messages
        // Common types: "explore:progress", "character:update", etc.
        if (msg.type === 'explore:progress' || msg.type === 'character:update') {
            console.log(`[Explore Monitor] Status:`, JSON.stringify(msg.payload, null, 2));
            if (msg.payload.expGained) {
                console.log(`[EXP] +${msg.payload.expGained} EXP gained!`);
            }
        }
    };

    // Enter Explore
    const result = await client.enterExplore();
    if (result) {
        console.log("[Explore] Currently in dungeon. Monitoring socket for changes...");
    } else {
        console.warn("[Explore] Failed to enter. Maybe already in one or out of stamina?");
    }

    // Keep process alive
    setInterval(() => {
        client.sendCommand('explore:status'); // Check status periodically
    }, 60000);
}

startExplore();
