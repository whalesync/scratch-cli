import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AuditLogService } from './audit-log.service';

@Module({
  imports: [DbModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
