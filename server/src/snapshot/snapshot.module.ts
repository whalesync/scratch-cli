import { Module } from '@nestjs/common';
import { ClerkModule } from 'src/clerk/clerk.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { RedisModule } from 'src/redis/redis.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { UploadsModule } from 'src/uploads/uploads.module';
import { UserModule } from 'src/users/users.module';
import { WorkerModule } from 'src/worker/workers.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { AiSnapshotController } from './ai-snapshot.controller';
import { SnapshotDbModule } from './snapshot-db.module';
import { SnapshotEventService } from './snapshot-event.service';
import { SnapshotController } from './snapshot.controller';
import { SnapshotDataGateway } from './snapshot.gateway';
import { SnapshotService } from './snapshot.service';

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
    ...(process.env.USE_JOBS === 'true' ? [WorkerModule] : []),
    SnapshotDbModule,
    UploadsModule,
  ],
  controllers: [SnapshotController, AiSnapshotController],
  providers: [SnapshotService, SnapshotEventService, SnapshotDataGateway],
  exports: [SnapshotService],
})
export class SnapshotModule {}
