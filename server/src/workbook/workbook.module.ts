import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ClerkModule } from 'src/clerk/clerk.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { RedisModule } from 'src/redis/redis.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { UserModule } from 'src/users/users.module';
import { WorkerEnqueuerModule } from 'src/worker-enqueuer/worker-enqueuer.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { AiSnapshotController } from './ai-snapshot.controller';
import { SnapshotDbModule } from './snapshot-db.module';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotDataGateway } from './snapshot.gateway';
import { WorkbookDbModule } from './workbook-db.module';
import { WorkbookPublicController } from './workbook-public.controller';
import { WorkbookController } from './workbook.controller';
import { WorkbookService } from './workbook.service';

@Module({
  imports: [
    DbModule,
    ConnectorsModule,
    ScratchpadConfigModule,
    ClerkModule,
    UserModule,
    PosthogModule,
    ConnectorAccountModule,
    RedisModule,
    WorkerEnqueuerModule,
    SnapshotDbModule,
    WorkbookDbModule,
    UploadsModule,
    AuditLogModule,
  ],
  controllers: [WorkbookController, AiSnapshotController, WorkbookPublicController],
  providers: [WorkbookService, SnapshotEventService, SnapshotDataGateway],
  exports: [WorkbookService, SnapshotEventService],
})
export class WorkbookModule {}
