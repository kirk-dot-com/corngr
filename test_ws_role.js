const WebSocket = require('ws');

function testRole(role, expectSuccess) {
    console.log(`\nTesting role: ${role} (Expect success: ${expectSuccess})`);

    const url = `ws://localhost:3030/test_room?userId=test-${role}&userRole=${role}`;
    const ws = new WebSocket(url);

    ws.on('open', () => {
        console.log(`✅ Connected as ${role}`);

        // Send a fake Yjs update
        // Logic: 
        // 1. We mock a minimal Yjs sync update.
        // For simplicity, we can send a "Step 1" sync message, which is technically a read request,
        // but to test WRITE rejection, we need to send an UPDATE message (MsgUpdate = 2).

        // Protocol: [Message Type (VarInt), Payload...]
        // MsgUpdate = 1? No, let's check yrs protocol.
        // SyncMessage::Sync(SyncMessage::Update(_)) usually corresponds to Yjs message type 0 (Sync) then 2 (Update).

        // Let's rely on the fact that if we send *some* binary data that decodes as an Update, it triggers the check.
        // Constructing a valid update manually is hard.
        // Instead, we can try to send a valid empty update?

        // Simpler approach: Send a dummy binary message that *looks* like a sync update.
        // Message Type 0 (Sync).
        // Sync Message Type 2 (Update).
        // Then an encoded update.

        // [0, 2, ... data]
        // 0 = Sync
        // 2 = Update
        // 0 = End of update (minimal empty update?)

        const buffer = Buffer.from([0, 2, 0]);
        ws.send(buffer);
        console.log("📤 Sent dummy update");

        setTimeout(() => {
            console.log("⏳ Timed out waiting for error");
            ws.close();
            // If we didn't get an error message, and we expected failure, this is a FAIL.
            // But the server sends a TEXT message on error.
        }, 2000);
    });

    ws.on('message', (data) => {
        console.log(`📥 Received: ${data}`);
        if (data.toString().includes("Access Denied")) {
            console.log("✅ Received expected Access Denied error");
            if (expectSuccess) {
                console.error("❌ FAILED: Unexpected error for allowed role");
            } else {
                console.log("✅ PASSED: Blocked unauthorized write");
            }
            ws.close();
        }
    });

    ws.on('error', (err) => {
        console.error(`❌ Connection error: ${err.message}`);
    });
}

// Install 'ws' first: npm install ws (or assume it's there?)
// We might not have 'ws' installed in the user environment. 
// We can use the browser subagent to run this logic? 
// Or better, use the browser subagent to run a simple script page.
