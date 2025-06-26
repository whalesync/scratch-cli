import { snapshotApi } from "../lib/api/snapshot.js";
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
  const snapshotId = args?.id as string;

  if (!snapshotId) {
    return {
      content: [
        {
          type: "text",
          text: "Snapshot ID is required",
        },
      ],
    };
  }

  try {
    // Verify snapshot exists on the server
    const snapshot = await snapshotApi.detail(snapshotId);
    snapshotManager.setActiveSnapshot(snapshot);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to connect to snapshot ${snapshotId}: ${error}`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Successfully connected to snapshot ${snapshotId}: ${
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
