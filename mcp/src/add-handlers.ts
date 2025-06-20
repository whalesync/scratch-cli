import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {CallToolRequestSchema, ListToolsRequestSchema} from '@modelcontextprotocol/sdk/types.js';

const SCRATCHPAD_API_SERVER = process.env.SCRATCHPAD_SERVER_URL ?? "http://localhost:3000";

export const addHandlers = (server: Server) => {

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: [
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
              description: "Update a record by ID",
              inputSchema: {
                type: "object",
                properties: {
                  id: {
                    type: "string",
                    description: "The ID of the record to update",
                  },
                  title: {
                    type: "string",
                    description: "The new title for the record",
                  },
                },
                required: ["id", "title"],
              },
            },
            {
              name: "create_record",
              description: "Create a new record",
              inputSchema: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "The title for the new record",
                  },
                },
                required: ["title"],
              },
            },
            {
              name: "create_records_batch",
              description: "Create multiple records at once",
              inputSchema: {
                type: "object",
                properties: {
                  titles: {
                    type: "array",
                    items: {
                      type: "string",
                      description: "The title for a new record",
                    },
                    description: "Array of titles for the new records",
                  },
                },
                required: ["titles"],
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
      
        if (name === "get_records") {
          try {
            const response = await fetch(`${SCRATCHPAD_API_SERVER}/records`);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const records = await response.json();
            
            return {
              content: [
                {
                  type: "text",
                  text: `Records retrieved successfully:\n\n${JSON.stringify(records, null, 2)}`,
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
          const { id, title } = args as { id: string, title: string };
          try {
            const response = await fetch(`${SCRATCHPAD_API_SERVER}/records/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stage: false, data: { title } }),
            });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }
            const record = await response.json();
            return {
              content: [
                {
                  type: "text",
                  text: `Record ${id} updated successfully: ${JSON.stringify(record, null, 2)}`,
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
          const { title } = args as { title: string };
          
          try {
            const response = await fetch(`${SCRATCHPAD_API_SERVER}/records`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify([{ title }]),
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newRecords = await response.json();
            
            return {
              content: [
                {
                  type: "text",
                  text: `Record created successfully:\n\n${JSON.stringify(newRecords[0], null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error creating record: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      
        if (name === "create_records_batch") {
          const titles = args.titles as string[];
          
          try {
            const response = await fetch(`${SCRATCHPAD_API_SERVER}/records`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(titles.map(title => ({ title }))),
            });
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const newRecords = await response.json();
            
            return {
              content: [
                {
                  type: "text",
                  text: `Records created successfully:\n\n${JSON.stringify(newRecords, null, 2)}`,
                },
              ],
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error creating records: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      
        if (name === "delete_record") {
          const { id } = args as { id: string };
          try {
            const response = await fetch(`${SCRATCHPAD_API_SERVER}/records/${id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stage: false }),
            });
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
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
            const response = await fetch(`${SCRATCHPAD_API_SERVER}/records`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
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
                  text: `Error deleting records: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
              ],
            };
          }
        }
      
        throw new Error(`Unknown tool: ${name}`);
      });
}