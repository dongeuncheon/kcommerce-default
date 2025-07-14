#!/bin/bash

echo "🚀 Starting Commerce Core in production mode..."

# Set environment
export NODE_ENV=production

# Start server
node dist/index.js