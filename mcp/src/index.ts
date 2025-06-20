import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { io, Socket } from "socket.io-client";

const serverCapabilities = {
  tools: {},
};

const SCRATCHPAD_API_SERVER = process.env.SCRATCHPAD_SERVER_URL ?? "http://localhost:3000";
const SCRATCHPAD_API_TOKEN = process.env.SCRATCHPAD_API_TOKEN ?? "";

// Create a new MCP server
const server = new Server(
  {
    name: "scratchpad-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: serverCapabilities,
  }
);

let socket: Socket | null = null;

// Connect to NestJS WebSocket server
function connectWebSocket() {
  try {
    socket = io(SCRATCHPAD_API_SERVER, {
      transports: ['websocket'],
      timeout: 5000, // 5 second timeout
    });

    socket.on('connect', () => {
      console.error('Connected to NestJS WebSocket server');
    });

    socket.on('recordsUpdated', async (records) => {
      console.error('Records updated, notifying Cursor...');
      try {
        await server.notification({
          method: "context/update",
          params: {
            tool: "get_records",
            content: [
              {
                type: "text",
                text: `Records retrieved successfully:\n\n${JSON.stringify(records, null, 2)}`,
              },
            ]
          }
        });
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    });

    socket.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    socket.on('connect_error', (error: Error) => {
      console.error('WebSocket connection error:', error);
    });

    socket.on('disconnect', (reason: string) => {
      console.error('WebSocket disconnected:', reason);
    });
  } catch (error) {
    console.error('Failed to initialize WebSocket connection:', error);
  }
}

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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Whalesync Scratchpad MCP Server started -- API Server: ", SCRATCHPAD_API_SERVER, " API Token: ", SCRATCHPAD_API_TOKEN);
    
  // Connect to WebSocket after server is ready (with a small delay)
  setTimeout(() => {
    try {
      connectWebSocket();
    } catch (error) {
      console.error("Failed to connect WebSocket, but server is still functional:", error);
    }
  }, 1000);
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
}); 