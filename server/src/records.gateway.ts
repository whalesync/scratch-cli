import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string } | null | undefined;
  suggested: { title: string } | null | undefined;
}

@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with your actual frontend origin
  },
})
export class RecordsGateway {
  @WebSocketServer()
  server: Server;

  notifyRecordUpdate(records: Record[]) {
    this.server.emit('recordsUpdated', records);
  }
}
