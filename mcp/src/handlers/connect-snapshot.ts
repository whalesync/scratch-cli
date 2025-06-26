export const CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION = {
  name: "connect_snapshot",
  description: "Connect to a specific snapshot for editing",
  inputSchema: {
    type: "object",
    properties: {},
    required: ["snapshotId"],
  },
};

export const connectSnapshot = async () => {
  return {
    content: [
      {
        type: "text",
        text: "Snapshot connected successfully",
      },
    ],
  };
};
