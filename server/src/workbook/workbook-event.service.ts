import { Injectable } from '@nestjs/common';
import { Workbook } from '@prisma/client';
import { WorkbookId } from '@spinner/shared-types';
import { Observable } from 'rxjs';
import { WSLogger } from 'src/logger';
import { RedisPubSubService } from 'src/redis/redis-pubsub.service';

import type { WorkbookEvent } from '@spinner/shared-types';

@Injectable()
export class WorkbookEventService {
  constructor(private readonly redisPubSub: RedisPubSubService) {}

  getWorkbookEvents(workbook: Workbook): Observable<WorkbookEvent> {
    const channel = this.createKey('workbook', workbook.id as WorkbookId);
    return this.redisPubSub.subscribe<WorkbookEvent>(channel);
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

  private createKey(prefix: string, workbookId: WorkbookId, secondaryId?: string) {
    return `${prefix}-${workbookId}${secondaryId ? `-${secondaryId}` : ''}`;
  }
}
