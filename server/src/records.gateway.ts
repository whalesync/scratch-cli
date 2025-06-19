import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

interface Record {
  id: string;
  title: string;
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
