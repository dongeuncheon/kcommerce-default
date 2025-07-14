#!/bin/bash

echo "🚀 Starting full build process..."

# Exit on error
set -e

# Build server
echo "📦 Building server..."
npm run build:server

# Build client
echo "📦 Building client..."
npm run build:client

echo "✅ Build completed successfully!"
echo ""
echo "To start in production mode:"
echo "  NODE_ENV=production npm start"
echo ""
echo "The server will serve both API and frontend on a single port."