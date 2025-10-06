import { Module } from '@nestjs/common';
import { ConnectorsModule } from 'src/remote-service/connectors/connectors.module';
import { SnapshotDbModule } from 'src/snapshot/snapshot-db.module';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';
import { JobModule } from '../job/job.module';
import { BullEnqueuerService } from './bull-enqueuer.service';
import { QueueService } from './bull-worker.service';
import { JobHandlerService } from './job-handler.service';
import { WorkerPoolService } from './piscina/worker-pool.service';
import { QueueTestService } from './test/queue-test.service';
import { WorkersController } from './test/workers.controller';

@Module({
  imports: [ScratchpadConfigModule, ConnectorsModule, SnapshotDbModule, JobModule],
  controllers: [WorkersController],
  providers: [WorkerPoolService, QueueService, QueueTestService, JobHandlerService, BullEnqueuerService],
  exports: [WorkerPoolService, QueueService, JobHandlerService, BullEnqueuerService],
})
export class WorkerModule {}
