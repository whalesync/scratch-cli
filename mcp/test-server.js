#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

// Test messages to send to the server
const testMessages = [
  {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: "test-client",
        version: "1.0.0"
      }
    }
  },
  {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list"
  },
  {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "google_search",
      arguments: {
        query: "test query"
      }
    }
  }
];

let messageIndex = 0;

// Send test messages
function sendNextMessage() {
  if (messageIndex < testMessages.length) {
    const message = testMessages[messageIndex];
    console.log(`\nSending: ${JSON.stringify(message, null, 2)}`);
    server.stdin.write(JSON.stringify(message) + '\n');
    messageIndex++;
  } else {
    console.log('\nTest completed. Press Enter to exit...');
    rl.once('line', () => {
      server.kill();
      process.exit(0);
    });
  }
}

// Handle server responses
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const response = JSON.parse(line);
      console.log(`\nReceived: ${JSON.stringify(response, null, 2)}`);
      
      // Send next message after a short delay
      setTimeout(sendNextMessage, 100);
    } catch (e) {
      // Ignore non-JSON lines
    }
  });
});

// Handle server errors
server.stderr.on('data', (data) => {
  console.error(`Server error: ${data}`);
});

// Start the test
console.log('Starting MCP server test...');
sendNextMessage();

// Handle process exit
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
}); 