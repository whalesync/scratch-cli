import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { API_CONFIG } from "./lib/api/config.js";
import {
  CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
  connectSnapshot,
} from "./handlers/connect-snapshot.js";
import {
  TEST_AUTH_MCP_TOOL_DEFINITION,
  testAuth,
} from "./handlers/test-auth.js";
import {
  DISCONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
  disconnectSnapshot,
} from "./handlers/disconnect_snapshot.js";
import {
  GET_RECORDS_MCP_TOOL_DEFINITION,
  getRecords,
} from "./handlers/get-records.js";
import {
  BULK_UPDATE_RECORDS_MCP_TOOL_DEFINITION,
  bulkUpdateRecords,
} from "./handlers/update-records.js";

export const addHandlers = (server: Server) => {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        TEST_AUTH_MCP_TOOL_DEFINITION,
        CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
        DISCONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
        GET_RECORDS_MCP_TOOL_DEFINITION,
        BULK_UPDATE_RECORDS_MCP_TOOL_DEFINITION,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("Arguments are required");
    }

    if (name === TEST_AUTH_MCP_TOOL_DEFINITION.name) {
      return await testAuth();
    }
    if (name === CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION.name) {
      return await connectSnapshot(args);
    }
    if (name === DISCONNECT_SNAPSHOT_MCP_TOOL_DEFINITION.name) {
      return await disconnectSnapshot(args);
    }
    if (name === GET_RECORDS_MCP_TOOL_DEFINITION.name) {
      return await getRecords(args);
    }
    if (name === BULK_UPDATE_RECORDS_MCP_TOOL_DEFINITION.name) {
      return await bulkUpdateRecords(args);
    }

    throw new Error(`Unknown tool: ${name}`);
  });
};
