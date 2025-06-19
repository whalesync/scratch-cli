import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with your actual frontend origin
  },
})
export class RecordsGateway {
  @WebSocketServer()
  server: Server;

  notifyRecordUpdate() {
    this.server.emit('recordsUpdated');
  }
}
