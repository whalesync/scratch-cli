import { workbookApi } from "../lib/api/snapshot.js";
import { snapshotManager } from "../state/snapshots.js";

export const CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION = {
  name: "connect_snapshot",
  description: "Connect to a specific snapshot for editing",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The ID of the snapshot to connect to",
      },
    },
    required: ["id"],
  },
};

export const connectSnapshot = async (
  args: Record<string, unknown> | undefined
) => {
  const workbookId = args?.id as string;

  if (!workbookId) {
    return {
      content: [
        {
          type: "text",
          text: "Workbook ID is required",
        },
      ],
    };
  }

  try {
    // Verify snapshot exists on the server
    const snapshot = await workbookApi.detail(workbookId);
    snapshotManager.setActiveSnapshot(snapshot);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to connect to snapshot ${workbookId}: ${error}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Successfully connected to snapshot ${workbookId}: ${
          snapshotManager.getActiveSnapshot()?.tables.length
        } table(s) found`,
      },
      {
        type: "text",
        text: `${JSON.stringify(snapshotManager.getActiveSnapshot(), null, 2)}`,
      },
    ],
  };
};
