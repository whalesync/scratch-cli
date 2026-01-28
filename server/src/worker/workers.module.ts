import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { ConnectorsModule } from 'src/remote-service/connectors/connectors.module';
import { UserModule } from 'src/users/users.module';
import { WorkbookDbModule } from 'src/workbook/workbook-db.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { JobModule } from '../job/job.module';
import { WorkerEnqueuerModule } from '../worker-enqueuer/worker-enqueuer.module';
import { QueueService } from './bull-worker.service';
import { JobHandlerService } from './job-handler.service';
import { WorkerPoolService } from './piscina/worker-pool.service';
import { QueueTestService } from './test/queue-test.service';
import { WorkersController } from './test/workers.controller';

@Module({
  imports: [
    ScratchpadConfigModule,
    WorkerEnqueuerModule,
    ConnectorsModule,
    WorkbookDbModule,
    WorkbookModule,
    JobModule,
    ConnectorAccountModule,
    UserModule,
  ],
  controllers: [WorkersController],
  providers: [WorkerPoolService, QueueService, QueueTestService, JobHandlerService],
  exports: [WorkerPoolService, QueueService, JobHandlerService],
})
export class WorkerModule {}
