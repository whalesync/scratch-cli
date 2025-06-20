import {Server} from '@modelcontextprotocol/sdk/server/index.js';
  
  
  // Create a new MCP server
  export const getServer = () => new Server(
    {
      name: "scratchpad-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  