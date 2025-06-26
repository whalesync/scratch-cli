import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { API_CONFIG } from "./lib/api/config.js";
import {
  CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
  connectSnapshot,
} from "./handlers/connect-snapshot.js";
import {
  TEST_AUTH_MCP_TOOL_DEFINITION,
  testAuth,
} from "./handlers/test-auth.js";

export const addHandlers = (server: Server) => {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        TEST_AUTH_MCP_TOOL_DEFINITION,
        CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION,
        {
          name: "get_records",
          description: "Get all records from the backend server",
          inputSchema: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "update_record",
          description: "Update a record by ID with field data",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The ID of the record to update",
              },
              fields: {
                type: "object",
                description:
                  "Object containing field names and their values (e.g., {title: 'New Title', description: 'New Description'})",
                additionalProperties: true,
              },
            },
            required: ["id", "fields"],
          },
        },
        {
          name: "create_record",
          description: "Create a new record with field data",
          inputSchema: {
            type: "object",
            properties: {
              fields: {
                type: "object",
                description:
                  "Object containing field names and their values (e.g., {title: 'New Title', description: 'New Description'})",
                additionalProperties: true,
              },
            },
            required: ["fields"],
          },
        },
        {
          name: "create_records_batch",
          description: "Create multiple records at once",
          inputSchema: {
            type: "object",
            properties: {
              records: {
                type: "array",
                items: {
                  type: "object",
                  description:
                    "Object containing field names and their values for each record",
                  additionalProperties: true,
                },
                description:
                  "Array of record objects, each containing field data",
              },
            },
            required: ["records"],
          },
        },
        {
          name: "delete_record",
          description: "Delete a record by ID",
          inputSchema: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "The ID of the record to delete",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "delete_records_batch",
          description: "Delete multiple records by their IDs",
          inputSchema: {
            type: "object",
            properties: {
              ids: {
                type: "array",
                items: {
                  type: "string",
                  description: "The ID of a record to delete",
                },
                description: "Array of record IDs to delete",
              },
            },
            required: ["ids"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("Arguments are required");
    }

    if (name === CONNECT_SNAPSHOT_MCP_TOOL_DEFINITION.name) {
      return await connectSnapshot();
    }
    if (name === TEST_AUTH_MCP_TOOL_DEFINITION.name) {
      return await testAuth();
    }

    if (name === "get_records") {
      try {
        const response = await fetch(`${API_CONFIG.getApiUrl()}/records`, {
          method: "GET",
          headers: {
            ...API_CONFIG.getApiHeaders(),
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const records = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `Records retrieved successfully:\n\n${JSON.stringify(
                records,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching records: ${error}`,
            },
          ],
        };
      }
    }

    if (name === "update_record") {
      const { id, fields } = args as {
        id: string;
        fields: Record<string, unknown>;
      };
      try {
        const response = await fetch(
          `${API_CONFIG.getApiUrl()}/records/${id}`,
          {
            method: "PUT",
            headers: {
              ...API_CONFIG.getApiHeaders(),
            },
            body: JSON.stringify({ stage: false, data: fields }),
          }
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, ${errorText}`
          );
        }
        const record = await response.json();
        return {
          content: [
            {
              type: "text",
              text: `Record ${id} updated successfully: ${JSON.stringify(
                record,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating record ${id}: ${error}`,
            },
          ],
        };
      }
    }

    if (name === "create_record") {
      const { fields } = args as { fields: Record<string, unknown> };

      try {
        const response = await fetch(`${API_CONFIG.getApiUrl()}/records`, {
          method: "POST",
          headers: {
            ...API_CONFIG.getApiHeaders(),
          },
          body: JSON.stringify(fields),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const newRecords = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `Record created successfully:\n\n${JSON.stringify(
                newRecords,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating record: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }

    if (name === "create_records_batch") {
      const { records } = args as { records: Record<string, unknown>[] };

      try {
        const response = await fetch(`${API_CONFIG.getApiUrl()}/records`, {
          method: "POST",
          headers: {
            ...API_CONFIG.getApiHeaders(),
          },
          body: JSON.stringify(records),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const newRecords = await response.json();

        return {
          content: [
            {
              type: "text",
              text: `Records created successfully:\n\n${JSON.stringify(
                newRecords,
                null,
                2
              )}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error creating records: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }

    if (name === "delete_record") {
      const { id } = args as { id: string };
      try {
        const response = await fetch(
          `${API_CONFIG.getApiUrl()}/records/${id}`,
          {
            method: "DELETE",
            headers: {
              ...API_CONFIG.getApiHeaders(),
            },
            body: JSON.stringify({ stage: false }),
          }
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status}, ${errorText}`
          );
        }
        return {
          content: [
            {
              type: "text",
              text: `Record ${id} marked for deletion successfully.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting record ${id}: ${error}`,
            },
          ],
        };
      }
    }

    if (name === "delete_records_batch") {
      const ids = args.ids as string[];

      try {
        const response = await fetch(`${API_CONFIG.getApiUrl()}/records`, {
          method: "DELETE",
          headers: {
            ...API_CONFIG.getApiHeaders(),
          },
          body: JSON.stringify(ids),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return {
          content: [
            {
              type: "text",
              text: `Records deleted successfully`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting records: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });
};
