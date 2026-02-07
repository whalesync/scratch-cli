import { Injectable } from '@nestjs/common';
import { Workbook } from '@prisma/client';
import { WorkbookId } from '@spinner/shared-types';
import { Observable } from 'rxjs';
import { WSLogger } from 'src/logger';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';

export interface WorkbookRecordEvent {
  type: 'record-changes';
  data: {
    tableId: string;
    numRecords: number;
    changeType: 'suggested' | 'accepted' | 'rejected';
    source: 'user' | 'agent';
    message?: string; // optional message to accompany the event to help with debugging
  };
}

export interface WorkbookEvent {
  type: 'workbook-updated' | 'filter-changed' | 'page-size-changed' | 'sync-status-changed';
  data: {
    tableId?: string;
    source: 'user' | 'agent';
    message?: string; // optional message to accompany the event to help with debugging
  };
}

@Injectable()
export class WorkbookEventService {
  constructor(private readonly redisPubSub: RedisPubSubService) {}

  getRecordEvents(workbook: Workbook, tableId: string): Observable<WorkbookRecordEvent> {
    const channel = this.createKey('records', workbook.id as WorkbookId, tableId);
    return this.redisPubSub.subscribe<WorkbookRecordEvent>(channel);
  }

  getWorkbookEvents(workbook: Workbook): Observable<WorkbookEvent> {
    const channel = this.createKey('workbook', workbook.id as WorkbookId);
    return this.redisPubSub.subscribe<WorkbookEvent>(channel);
  }

  sendRecordEvent(workbookId: WorkbookId, tableId: string, event: WorkbookRecordEvent): void {
    const channel = this.createKey('records', workbookId, tableId);
    this.redisPubSub.publish(channel, event).catch((error) => {
      WSLogger.error({
        source: WorkbookEventService.name,
        message: 'Failed to publish record event to Redis',
        error: error,
        channel: channel,
        event: event,
      });
    });
  }

  sendWorkbookEvent(workbookId: WorkbookId, event: WorkbookEvent): void {
    const channel = this.createKey('workbook', workbookId);
    this.redisPubSub.publish(channel, event).catch((error) => {
      WSLogger.error({
        source: WorkbookEventService.name,
        message: 'Failed to publish workbook event to Redis',
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
