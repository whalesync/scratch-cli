import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
import { CLEAR_FILTERED_VIEW_MCP_TOOL_DEFINITION, clearFilteredView } from "./handlers/clear-active-filter.js";
import { LIST_FILTERED_VIEWS_MCP_TOOL_DEFINITION, listFilteredViews } from "./handlers/list-filtered-views.js";

export const addHandlers = (server: Server) => {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        TEST_AUTH_MCP_TOOL_DEFINITION,
        CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
        DISCONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
        GET_RECORDS_MCP_TOOL_DEFINITION,
        BULK_UPDATE_RECORDS_MCP_TOOL_DEFINITION,
        CLEAR_FILTERED_VIEW_MCP_TOOL_DEFINITION,
        LIST_FILTERED_VIEWS_MCP_TOOL_DEFINITION,
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
    if (name === CLEAR_FILTERED_VIEW_MCP_TOOL_DEFINITION.name) {
      return await clearFilteredView(args);
    }
    if (name === LIST_FILTERED_VIEWS_MCP_TOOL_DEFINITION.name) {
      return await listFilteredViews(args);
    }

    throw new Error(`Unknown tool: ${name}`);
  });
};
