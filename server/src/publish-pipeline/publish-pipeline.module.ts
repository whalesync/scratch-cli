import { Module } from '@nestjs/common';
import { CredentialEncryptionModule } from '../credential-encryption/credential-encryption.module';
import { DbModule } from '../db/db.module';
import { ConnectorsModule } from '../remote-service/connectors/connectors.module';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';

import { ScratchGitModule } from '../scratch-git/scratch-git.module';
import { WorkerEnqueuerModule } from '../worker-enqueuer/worker-enqueuer.module';
import { PipelineBuildService } from './pipeline-build.service';
import { PipelineRunService } from './pipeline-run.service';
import { PublishPipelineController } from './publish-pipeline.controller';
import { RefCleanerService } from './ref-cleaner.service';

@Module({
  imports: [DbModule, ScratchGitModule, WorkerEnqueuerModule, ConnectorsModule, CredentialEncryptionModule],
  controllers: [PublishPipelineController],
  providers: [FileIndexService, FileReferenceService, PipelineBuildService, PipelineRunService, RefCleanerService],
  exports: [FileIndexService, FileReferenceService, PipelineBuildService, PipelineRunService, RefCleanerService],
})
export class PublishPipelineModule {}
