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

export const createFilteredView = async (args: Record<string, unknown> | undefined) => {
  const snapshot = snapshotManager.getActiveSnapshot();
  const tableId = args?.tableId as string;
  const viewName = args?.name as string;
  const recordIds = args?.recordIds as string[];

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

  if (!viewName) { return {
    content: [
      {
        type: "text",
        text: "A name is required for the filtered view.",
      },
    ],
  };
}


  if (!recordIds || recordIds.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "One or more records must be added to create a filtered view.",
        },
      ],
    };
  }

  try {
    const viewId = await snapshotApi.activateView(
      snapshot.id,
      tableId,
      {
        source: "agent",
        name: viewName,
        recordIds,
      }
    );
    return {
      content: [
        {
          type: "text",
          text: `Successfully created filtered view for table ${tableId}`,
        },
        {
          type: "text",
          text: `{
            "viewId": "${viewId}",
          }`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to create filter on table ${tableId}: ${error}`,
        },
      ],
    };
  }
};
