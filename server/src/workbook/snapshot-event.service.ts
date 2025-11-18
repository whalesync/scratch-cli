import { Injectable } from '@nestjs/common';
import { Workbook } from '@prisma/client';
import { Observable } from 'rxjs';
import { WSLogger } from 'src/logger';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';
import { WorkbookId } from '../types/ids';

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

  getRecordEvents(workbook: Workbook, tableId: string): Observable<SnapshotRecordEvent> {
    const channel = this.createKey('records', workbook.id as WorkbookId, tableId);
    return this.redisPubSub.subscribe<SnapshotRecordEvent>(channel);
  }

  getSnapshotEvents(workbook: Workbook): Observable<SnapshotEvent> {
    const channel = this.createKey('snapshot', workbook.id as WorkbookId);
    return this.redisPubSub.subscribe<SnapshotEvent>(channel);
  }

  sendRecordEvent(workbookId: WorkbookId, tableId: string, event: SnapshotRecordEvent): void {
    const channel = this.createKey('records', workbookId, tableId);
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

  sendSnapshotEvent(workbookId: WorkbookId, event: SnapshotEvent): void {
    const channel = this.createKey('snapshot', workbookId);
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

  private createKey(prefix: string, workbookId: WorkbookId, tableId?: string) {
    return `${prefix}-${workbookId}${tableId ? `-${tableId}` : ''}`;
  }
}
