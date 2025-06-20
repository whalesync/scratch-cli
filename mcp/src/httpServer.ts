import express from 'express';
import { spawn } from 'child_process';
import path from 'path';

const app = express();

app.post('/mcp', (req, res) => {
  const mcpProcess = spawn('node', [path.resolve(__dirname, 'index.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Forward the request body to the MCP process's stdin
  req.pipe(mcpProcess.stdin);

  // Forward the MCP process's stdout to the response
  mcpProcess.stdout.pipe(res);

  // Handle errors
  mcpProcess.stderr.on('data', (data) => {
    console.error(`MCP process error: ${data}`);
  });

  // Clean up when the request closes
  req.on('close', () => {
    mcpProcess.kill();
  });
});

const PORT = process.env.MCP_PORT || 4000;
app.listen(PORT, () => {
  console.log(`MCP HTTP Server listening on port ${PORT}`);
});