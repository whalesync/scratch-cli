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
import { Server } from 'socket.io';
import { SocketWithUser } from 'src/auth/types';
import { WebSocketAuthGuard } from 'src/auth/websocket-auth-guard';
import { WSLogger } from 'src/logger';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { SnapshotId } from 'src/types/ids';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotService } from './snapshot.service';

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

  constructor(
    readonly snapshotEventService: SnapshotEventService,
    readonly snapshotService: SnapshotService,
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

    this.server.emit('pong', 'pong');
  }

  @SubscribeMessage('subscribe')
  async handleSubscribeToSnapshot(
    @ConnectedSocket() client: SocketWithUser,
    @MessageBody() data: { snapshotId: string },
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

    const snapshotId = data.snapshotId as SnapshotId;
    const snapshot = await this.snapshotService.findOne(snapshotId, client.user.id);
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
      snapshotId,
      message: 'subscribed to snapshot events',
    });

    (snapshot.tableSpecs as AnyTableSpec[]).forEach((tableSpec) => {
      const tableObservable = this.snapshotEventService.getRecordEvents(snapshot, tableSpec);
      if (tableObservable) {
        tableObservable.subscribe((event) => {
          // send a confirmation message to the client
          client.emit('record-event', event);
        });
        client.emit('record-event-subscription-confirmed', {
          snapshotId,
          tableId: tableSpec.id.wsId,
          message: 'subscribed to record events',
        });
      }
    });
  }
}
