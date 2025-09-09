import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getServer } from "../server.js";
import { connectWebSocket } from "../connectWebsockets.js";
import { addHandlers } from "../add-handlers.js";

import { PROJECT_NAME, API_SERVER_URL, API_TOKEN } from "../constants.js";

/**
 * This server is the entry point for MCP when it is integrated into an AI agent like Cursor
 */
async function main() {
  const transport = new StdioServerTransport();
  const server = getServer();
  addHandlers(server);
  await server.connect(transport);
  console.error(
    `Whalesync ${PROJECT_NAME} MCP Server started -- API Server: `,
    API_SERVER_URL,
    " API Token: ",
    API_TOKEN
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
