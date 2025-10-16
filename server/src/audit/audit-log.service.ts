import { Injectable } from '@nestjs/common';
import { AuditLogEvent } from '@prisma/client';
import { AnyId, createAuditLogEventId } from 'src/types/ids';
import { DbService } from '../db/db.service';
import { AuditLogEventType } from './types';

@Injectable()
export class AuditLogService {
  constructor(private readonly dbService: DbService) {}

  async logEvent(args: {
    userId: string;
    eventType: AuditLogEventType;
    message: string;
    entityId: AnyId;
    context?: Record<string, any>;
  }): Promise<AuditLogEvent> {
    // write the event to the database
    return this.dbService.client.auditLogEvent.create({
      data: {
        id: createAuditLogEventId(),
        userId: args.userId,
        eventType: args.eventType,
        message: args.message,
        entityId: args.entityId,
        context: args.context || undefined,
      },
    });
  }
}
