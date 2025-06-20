import {io, Socket} from 'socket.io-client';
import {getServer} from './server.js';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';

const SCRATCHPAD_API_SERVER = process.env.SCRATCHPAD_SERVER_URL ?? "http://localhost:3000";

let socket: Socket | null = null;

// Connect to NestJS WebSocket server
export function connectWebSocket(server: Server) {
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