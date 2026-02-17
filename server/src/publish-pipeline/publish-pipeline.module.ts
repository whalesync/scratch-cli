import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';

import { ScratchGitModule } from '../scratch-git/scratch-git.module';
import { WorkerEnqueuerModule } from '../worker-enqueuer/worker-enqueuer.module';
import { PipelineBuildService } from './pipeline-build.service';
import { PipelineRunService } from './pipeline-run.service';
import { PublishPipelineController } from './publish-pipeline.controller';

@Module({
  imports: [DbModule, ScratchGitModule, WorkerEnqueuerModule],
  controllers: [PublishPipelineController],
  providers: [FileIndexService, FileReferenceService, PipelineBuildService, PipelineRunService],
  exports: [FileIndexService, FileReferenceService, PipelineBuildService, PipelineRunService],
})
export class PublishPipelineModule {}
