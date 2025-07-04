import { snapshotManager } from "../state/snapshots.js";
import { snapshotApi } from "../lib/api/snapshot.js";

export const CLEAR_FILTERED_VIEW_MCP_TOOL_DEFINITION = {
  name: "clear_record_filter",
  description: "Remove the active filtered view from the table context",
  inputSchema: {
    type: "object",
    properties: {
      tableId: {
        type: "string",
        description: "The ID of the table clear the active view filter for",
      },
    },
    required: ["tableId"],
  },
};

export const clearFilteredView = async (args: Record<string, unknown> | undefined) => {
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
    const viewId = await snapshotApi.clearActiveView(
      snapshot.id,
      tableId,
    );
    return {
      content: [
        {
          type: "text",
          text: `Successfully cleared filtered view for table ${tableId}`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to clear filter on table ${tableId}: ${error}`,
        },
      ],
    };
  }
};
