import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getServer } from "../server.js";
import { connectWebSocket } from "../connectWebsockets.js";
import { addHandlers } from "../add-handlers.js";

import { SCRATCHPAD_API_SERVER, SCRATCHPAD_API_TOKEN } from "../constants.js";

/**
 * This server is the entry point for MCP when it is integrated into an AI agent like Cursor
 */
async function main() {
  const transport = new StdioServerTransport();
  const server = getServer();
  addHandlers(server);
  await server.connect(transport);
  console.error(
    "Whalesync Scratchpad MCP Server started -- API Server: ",
    SCRATCHPAD_API_SERVER,
    " API Token: ",
    SCRATCHPAD_API_TOKEN
  );

  // Connect to WebSocket after server is ready (with a small delay)
  setTimeout(() => {
    try {
      connectWebSocket(server);
    } catch (error) {
      console.error(
        "Failed to connect WebSocket, but server is still functional:",
        error
      );
    }
  }, 1000);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
