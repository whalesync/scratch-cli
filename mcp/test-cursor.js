#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

console.error('Starting MCP server test for Cursor...');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Simple initialization message
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    clientInfo: {
      name: "cursor-test",
      version: "1.0.0"
    }
  }
};

// Send initialization message
console.error('Sending initialization message...');
server.stdin.write(JSON.stringify(initMessage) + '\n');

// Handle server responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      console.error(`Received: ${JSON.stringify(response, null, 2)}`);
      
      if (response.id === 1 && response.result) {
        console.error('✅ MCP server initialized successfully!');
        server.kill();
        process.exit(0);
      }
    } catch (e) {
      // Ignore non-JSON lines
    }
  });
});

// Handle server errors
server.stderr.on('data', (data) => {
  console.error(`Server stderr: ${data}`);
});

// Handle server process errors
server.on('error', (error) => {
  console.error(`Server process error: ${error}`);
  process.exit(1);
});

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`Server exited with code ${code}`);
    process.exit(code);
  }
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);

// Handle process exit
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
}); 