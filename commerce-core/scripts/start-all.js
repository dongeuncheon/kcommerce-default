#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Commerce Core Development Environment...\n');

// Start backend server
const backend = spawn('npm', ['run', 'dev:server'], {
  cwd: path.resolve(__dirname, '..'),
  stdio: 'inherit',
  shell: true
});

// Wait a bit for backend to start
setTimeout(() => {
  // Start frontend client
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.resolve(__dirname, '../client'),
    stdio: 'inherit',
    shell: true
  });

  frontend.on('error', (err) => {
    console.error('Frontend failed to start:', err);
  });
}, 3000);

backend.on('error', (err) => {
  console.error('Backend failed to start:', err);
});

// Handle exit
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development environment...');
  process.exit();
});