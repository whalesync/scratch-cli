import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface DataRecord {
  id: string;
  remote: Record<string, unknown>;
  staged: Record<string, unknown> | null | undefined;
  suggested: Record<string, unknown> | null | undefined;
}

@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with your actual frontend origin
  },
})
export class RecordsGateway {
  @WebSocketServer()
  server: Server;

  notifyRecordUpdate(records: DataRecord[]): void {
    this.server.emit('recordsUpdated', records);
  }
}
