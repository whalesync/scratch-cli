import { snapshotManager } from "../state/snapshots.js";
import { snapshotApi } from "../lib/api/snapshot.js";

export const CREATE_FILTERED_VIEW_MCP_TOOL_DEFINITION = {
  name: "create_filtered_view",
  description: "Filter the records for a table to a subset of records for use in the context",
  inputSchema: {
    type: "object",
    properties: {
      tableId: {
        type: "string",
        description: "The ID of the table to get records for",
      },
      name: {
        type: "string",
        description: "A short name of the filtered view to help you identify it. Less than 50 characters.",
      },
      recordIds: {
        type: "array",
        description: "An array of wsIdsfor the records that are included in the filtered view",
        default: [],
        items: {
          type: "string",
          description: "The wsId of the record to include in the filtered view",
        },
      },
    },
    required: ["tableId", "recordIds", "name"],
  },
};
