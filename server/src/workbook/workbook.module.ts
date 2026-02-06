import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ClerkModule } from 'src/clerk/clerk.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { RedisModule } from 'src/redis/redis.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { UserModule } from 'src/users/users.module';
import { WorkerEnqueuerModule } from 'src/worker-enqueuer/worker-enqueuer.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { ScratchGitModule } from '../scratch-git/scratch-git.module';
import { FilesPublicController } from './files-public.controller';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotDataGateway } from './snapshot.gateway';
import { WorkbookController } from './workbook.controller';
import { WorkbookService } from './workbook.service';

import { DataFolderPublishingService } from './data-folder-publishing.service';
import { DataFolderController } from './data-folder.controller';
import { DataFolderService } from './data-folder.service';

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
    AuditLogModule,
    ScratchGitModule,
  ],
  controllers: [WorkbookController, FilesController, FilesPublicController, DataFolderController],
  providers: [
    WorkbookService,
    SnapshotEventService,
    SnapshotDataGateway,
    FilesService,
    DataFolderService,
    DataFolderPublishingService,
  ],
  exports: [WorkbookService, SnapshotEventService, FilesService, DataFolderService, DataFolderPublishingService],
})
export class WorkbookModule {}
