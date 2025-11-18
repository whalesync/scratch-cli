import { snapshotManager } from "../state/snapshots.js";
import { workbookApi } from "../lib/api/snapshot.js";

export const LIST_FILTERED_VIEWS_MCP_TOOL_DEFINITION = {
  name: "list_filtered_views",
  description: "List all filtered views for a table in the active snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      tableId: {
        type: "string",
        description: "The ID of the table to list views for.",
      },
    },
    required: ["tableId"],
  },
};

export const listFilteredViews = async (
  args: Record<string, unknown> | undefined
) => {
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
    const views = await workbookApi.listViews(snapshot.id, tableId);
    return {
      content: [
        {
          type: "text",
          text: `Found ${views.length} filtered views for table ${tableId}.`,
        },
        {
          type: "text",
          text: JSON.stringify(views, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to list filtered views for table ${tableId}: ${error}`,
        },
      ],
    };
  }
};
