import { snapshotManager } from "../state/snapshots.js";

export const DISCONNECT_SNAPSHOT_MCP_TOOL_DEFINITION = {
  name: "disconnect_snapshot",
  description: "Disconnect from the active snapshot",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const disconnectSnapshot = async (
  _args: Record<string, unknown> | undefined
) => {
  const snapshot = snapshotManager.clearActiveSnapshot();
  return {
    content: [
      {
        type: "text",
        text: "Disconnected from all active snapshots",
      },
    ],
  };
};
