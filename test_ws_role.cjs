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

        // 1. Test Sync Update (Type 2)
        const updateMsg = Buffer.from([0, 2, 0]);
        ws.send(updateMsg);
        console.log("📤 Sent dummy Update (Type 2)");

        // 2. Test Sync Step 2 (Type 1) - also a write operation
        setTimeout(() => {
            const step2Msg = Buffer.from([0, 1, 0]);
            ws.send(step2Msg);
            console.log("📤 Sent dummy SyncStep2 (Type 1)");
        }, 500);

        setTimeout(() => {
            console.log("⏳ Timed out waiting for error");
            ws.close();
            // If we expected failure (read-only), timeout means we FAILED to block it
            if (!expectSuccess) {
                // But wait, we close connection on error. If we are still here, we didn't get error.
                // So for read-only roles, this timeout implies the server ACCEPTED the write (silently).
                console.error("❌ FAILED: Server accepted write silently (or didn't error)");
            }
        }, 3000);
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

// Run tests
console.log("Starting WebSocket Role Tests...");
setTimeout(() => testRole('auditor', false), 100);
setTimeout(() => testRole('viewer', false), 3000);
setTimeout(() => testRole('editor', true), 6000);
