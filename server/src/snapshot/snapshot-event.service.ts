import { Injectable } from '@nestjs/common';
import { Snapshot } from '@prisma/client';
import { Observable } from 'rxjs';
import { WSLogger } from 'src/logger';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';

export interface SnapshotRecordEvent {
  type: 'record-changes';
  data: {
    tableId: string;
    numRecords: number;
    changeType: 'suggested' | 'accepted' | 'rejected';
    source: 'user' | 'agent';
  };
}

export interface SnapshotEvent {
  type: 'snapshot-updated' | 'filter-changed';
  data: {
    tableId?: string;
    source: 'user' | 'agent';
  };
}

@Injectable()
export class SnapshotEventService {
  constructor(private readonly redisPubSub: RedisPubSubService) {}

  getRecordEvents(snapshot: Snapshot, tableId: string): Observable<SnapshotRecordEvent> {
    const channel = this.createKey('records', snapshot.id, tableId);
    return this.redisPubSub.subscribe<SnapshotRecordEvent>(channel);
  }

  getSnapshotEvents(snapshot: Snapshot): Observable<SnapshotEvent> {
    const channel = this.createKey('snapshot', snapshot.id);
    return this.redisPubSub.subscribe<SnapshotEvent>(channel);
  }

  sendRecordEvent(snapshot: string, tableId: string, event: SnapshotRecordEvent): void {
    const channel = this.createKey('records', snapshot, tableId);
    this.redisPubSub.publish(channel, event).catch((error) => {
      WSLogger.error({
        source: SnapshotEventService.name,
        message: 'Failed to publish record event to Redis',
        error: error,
        channel: channel,
        event: event,
      });
    });
  }

  sendSnapshotEvent(snapshotId: string, event: SnapshotEvent): void {
    const channel = this.createKey('snapshot', snapshotId);
    this.redisPubSub.publish(channel, event).catch((error) => {
      WSLogger.error({
        source: SnapshotEventService.name,
        message: 'Failed to publish snapshot event to Redis',
        error: error,
        channel: channel,
        event: event,
      });
    });
  }

  private createKey(prefix: string, snapshotId: string, tableId?: string) {
    return `${prefix}-${snapshotId}${tableId ? `-${tableId}` : ''}`;
  }
}
