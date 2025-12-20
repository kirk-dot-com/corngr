#!/bin/bash

# Corngr Phase 1 Verification Script

echo "🌽 Starting Corngr Phase 1 Demo..."
echo "---------------------------------------------------"

# 1. Run Rust Security Tests (ABAC Verification)
echo "🔒 [1/2] Verifying Rust Security Tests..."
cd src-tauri

if command -v cargo &> /dev/null; then
    cargo test
    TEST_EXIT_CODE=$?
    
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo "✅ Security Tests Passed!"
    else
        echo "❌ Security Tests Failed."
        echo "   Please check src-tauri/src/lib.rs for errors."
        exit 1
    fi
else
    echo "⚠️  'cargo' command not found."
    echo "   Skipping automated test run. Assuming tests passed or environment is web-only."
fi

cd ..

# 2. Launch Application
echo "---------------------------------------------------"
echo "🚀 [2/2] Launching Corngr App..."
echo "   - Mode: Tauri Development (Web + Native Rust)"
echo "   - Expected: Window should open. 'demo.crng' file should appear in project root."
echo "   - URL: http://localhost:1420"
echo "---------------------------------------------------"

npm run tauri dev
