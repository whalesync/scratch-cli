import { snapshotManager } from "../state/snapshots.js";
import { workbookApi } from "../lib/api/snapshot.js";

export const GET_RECORDS_MCP_TOOL_DEFINITION = {
  name: "get_records",
  description:
    "Get the current records for a table. If there is an active view or filter only those records will be returned.",
  inputSchema: {
    type: "object",
    properties: {
      tableId: {
        type: "string",
        description: "The ID of the table to get records for",
      },
      limit: {
        type: "number",
        description: "The maximum number of records to retrieve.",
        default: 1000,
        optional: true,
      },
    },
    required: ["tableId"],
  },
};

export const getRecords = async (args: Record<string, unknown> | undefined) => {
  const snapshot = snapshotManager.getActiveSnapshot();
  const tableId = args?.tableId as string;
  const limit = args?.limit ? parseInt(args.limit as string) : 100;

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
    const result = await workbookApi.listRecords(
      snapshot.id,
      tableId,
      undefined,
      limit,
      undefined // MCP doesn't have access to current view context
    );
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
