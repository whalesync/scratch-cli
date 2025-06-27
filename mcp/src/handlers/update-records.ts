import { snapshotManager } from "../state/snapshots.js";
import { snapshotApi } from "../lib/api/snapshot.js";
import { RecordOperation } from "../lib/api/types/records.js";

export const BULK_UPDATE_RECORDS_MCP_TOOL_DEFINITION = {
  name: "bulk_update_records",
  description:
    "Create, update, or delete multiple records in a single batch for a table in the active snapshot.",
  inputSchema: {
    type: "object",
    properties: {
      tableId: {
        type: "string",
        description: "The ID of the table to update records for.",
      },
      ops: {
        type: "array",
        description:
          "Array of record operations. Each operation must specify an op ('create', 'update', or 'delete'), an wsId that uniquely identifies the record for update/delete, and optional data for create/update.",
        items: {
          anyOf: [
            {
              type: "object",
              properties: {
                op: {
                  type: "string",
                  enum: ["create"],
                },
                wsId: {
                  type: "string",
                  description:
                    "A dummy value that will be ignored by the server",
                },
                data: {
                  type: "object",
                  description: "Field data for the record to create",
                  additionalProperties: true,
                },
              },
              required: ["op", "wsId", "data"],
            },
            {
              type: "object",
              properties: {
                op: {
                  type: "string",
                  enum: ["update"],
                },
                wsId: {
                  type: "string",
                  description: "The unique record ID for the record to update",
                },
                data: {
                  type: "object",
                  description: "Field data for the record to create",
                  additionalProperties: true,
                },
              },
              required: ["op", "wsId", "data"],
            },
            {
              type: "object",
              properties: {
                op: {
                  type: "string",
                  enum: ["delete"],
                },
                wsId: {
                  type: "string",
                  description: "The unique record ID for the record to delete",
                },
              },
              required: ["op", "wsId"],
            },
          ],
        },
      },
    },
    required: ["tableId", "ops"],
  },
};

export const bulkUpdateRecords = async (
  args: Record<string, unknown> | undefined
) => {
  const snapshot = snapshotManager.getActiveSnapshot();
  const tableId = args?.tableId as string;
  const ops = args?.ops as RecordOperation[];

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
  if (!Array.isArray(ops) || ops.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "At least one operation is required.",
        },
      ],
    };
  }

  try {
    await snapshotApi.bulkUpdateRecords(snapshot.id, tableId, { ops });
    return {
      content: [
        {
          type: "text",
          text: `Bulk update successful for table ${tableId}. ${ops.length} operations performed.`,
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to bulk update records for table ${tableId}: ${error}`,
        },
      ],
    };
  }
};
