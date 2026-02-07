import { UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { WorkbookId } from '@spinner/shared-types';
import { Server } from 'socket.io';
import type { SocketWithUser } from 'src/auth/types';
import { WebSocketAuthGuard } from 'src/auth/websocket-auth-guard';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { userToActor } from 'src/users/types';
import { SnapshotEventService } from './snapshot-event.service';
import { WorkbookService } from './workbook.service';

@UseGuards(WebSocketAuthGuard)
@WebSocketGateway({
  cors: {
    origin: '*', // In production, restrict this to your frontend origin
  },
  path: '/snapshot-events',
  transports: ['websocket'],
  // Configure timeouts to be more resilient to browser throttling
  pingTimeout: 60000, // 60 seconds - matches client configuration
  pingInterval: 25000, // 25 seconds - matches client configuration
  upgradeTimeout: 10000, // 10 seconds for transport upgrade
})
export class SnapshotDataGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server?: Server;

  constructor(
    readonly configService: ScratchpadConfigService,
    readonly snapshotEventService: SnapshotEventService,
    readonly snapshotService: WorkbookService,
  ) {}

  afterInit(server: Server) {
    WSLogger.info({
      message: 'Snapshot data gateway initialized',
      source: 'SnapshotDataGateway',
      server: server.eventNames(),
    });
  }

  handleConnection(client: SocketWithUser) {
    WSLogger.info({
      message: 'Client connected to snapshot data gateway',
      source: 'SnapshotDataGateway',
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
      source: 'SnapshotDataGateway',
      userId: client.user?.id || 'unknown',
    });
  }

  @SubscribeMessage('ping')
  handleSnapshotEvents(client: SocketWithUser, data: string): void {
    WSLogger.info({
      message: 'Snapshot events message received',
      source: 'SnapshotDataGateway',
      data,
      userId: client.user?.id,
    });

    this.getServer().emit('pong', 'pong');
  }

  @SubscribeMessage('subscribe')
  async handleSubscribeToSnapshot(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { workbookId: WorkbookId },
  ): Promise<void> {
    WSLogger.info({
      message: 'Subscribe to snapshot message received',
      source: 'SnapshotDataGateway',
      data,
    });

    // the auth guard should have setup the user on the client
    if (!client.user) {
      WSLogger.error({
        message: 'User not found',
        source: 'SnapshotDataGateway',
        data,
      });
      throw new WsException('User not found');
    }

    const workbookId = data.workbookId;
    const snapshot = await this.snapshotService.findOne(workbookId, userToActor(client.user));
    if (!snapshot) {
      WSLogger.error({
        message: 'Snapshot not found',
        source: 'SnapshotDataGateway',
        data,
      });
      throw new WsException('Snapshot not found');
    }

    const snapshotObservable = this.snapshotEventService.getSnapshotEvents(snapshot);
    snapshotObservable.subscribe((event) => {
      // todo repackage the event and send to the client
      client.emit('snapshot-event', event);
    });

    // send a confirmation message to the client
    client.emit('snapshot-event-subscription-confirmed', {
      workbookId,
      message: 'subscribed to workbook events',
    });

    // TODO - subscribe to data folders updating
  }

  private getServer(): Server {
    if (!this.server) {
      throw new Error('Expected server to not be undefined');
    }
    return this.server;
  }
}
