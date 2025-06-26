import { snapshotManager } from "../state/snapshots.js";
import { snapshotApi } from "../lib/api/snapshot.js";

export const GET_RECORDS_MCP_TOOL_DEFINITION = {
  name: "get_records",
  description: "Get get all records for a table",
  inputSchema: {
    type: "object",
    properties: {
      tableId: {
        type: "string",
        description: "The ID of the table to get records for",
      },
    },
    required: ["tableId"],
  },
};

export const getRecords = async (args: Record<string, unknown> | undefined) => {
  const snapshot = snapshotManager.getActiveSnapshot();
  const tableId = args?.tableId as string;

  if (!snapshot) {
    return {
      content: [
        {
          type: "text",
          text: "No active snapshot. Please connect to a snapshot first.",
        },
      ],
    };
  }
  if (!tableId) {
    return {
      content: [
        {
          type: "text",
          text: "Table ID is required.",
        },
      ],
    };
  }

  try {
    const result = await snapshotApi.listRecords(snapshot.id, tableId);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result.records, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to get records for table ${tableId}: ${error}`,
        },
      ],
    };
  }
};
