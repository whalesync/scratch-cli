import { UseGuards } from '@nestjs/common';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SocketWithUser } from 'src/auth/types';
import { WebSocketAuthGuard } from 'src/auth/websocket-auth-guard';
import { WSLogger } from 'src/logger';

@UseGuards(WebSocketAuthGuard)
@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to your frontend origin
  },
  path: '/snapshot-events',
  transports: ['websocket'],
})
export class SnapshotDataGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor() {}

  afterInit(server: Server) {
    WSLogger.info({
      message: 'Snapshot data gateway initialized',
      source: 'snapshot.gateway',
      server: server.eventNames(),
    });
  }

  handleConnection(client: SocketWithUser) {
    WSLogger.info({
      message: 'Client connected to snapshot data gateway',
      source: 'snapshot.gateway',
      userId: client.user?.id || 'unknown',
      auth: client.handshake.auth,
    });

    /**
     * responde with a connection confirmation message
     * register the client
     */
  }

  handleDisconnect(client: SocketWithUser) {
    WSLogger.info({
      message: 'Client disconnected from snapshot data gateway',
      source: 'snapshot.gateway',
      userId: client.user?.id || 'unknown',
    });
  }

  @SubscribeMessage('ping')
  handleSnapshotEvents(client: SocketWithUser, data: string): void {
    WSLogger.info({
      message: 'Snapshot events message received',
      source: 'snapshot.gateway',
      data,
      userId: client.user?.id,
    });

    this.server.emit('pong', 'pong');
  }
}
