#!/bin/bash

# Corngr Local Launch Script
# Use this to start the development environment (Desktop + Browser)

echo "🌽 Launching Corngr Locally..."
echo "---------------------------------------------------"

# 1. Check for node_modules
if [ ! -d "node_modules" ]; then
    echo "📦 node_modules not found. Installing dependencies..."
    npm install
fi

# 2. Check for Tauri CLI
if ! npx tauri --version > /dev/null 2>&1; then
    echo "❌ Tauri CLI not found. Please ensure you have the Tauri environment set up."
    echo "See: https://tauri.app/v1/guides/getting-started/prerequisites"
    exit 1
fi

# 3. Launch the App
echo "🚀 Starting development server and native backend..."
echo "   - Local Web UI: http://localhost:1420"
echo "   - Desktop App: Initializing..."
echo "---------------------------------------------------"

npm run tauri dev
