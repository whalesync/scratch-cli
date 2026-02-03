import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { JobModule } from 'src/job/job.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { ConnectorsModule } from 'src/remote-service/connectors/connectors.module';
import { ScratchGitModule } from 'src/scratch-git/scratch-git.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { WorkerEnqueuerModule } from 'src/worker-enqueuer/worker-enqueuer.module';
import { CliAuthController } from './cli-auth.controller';
import { CliAuthService } from './cli-auth.service';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';

@Module({
  imports: [
    ScratchpadConfigModule,
    AuthModule,
    ConnectorsModule,
    DbModule,
    JobModule,
    PosthogModule,
    WorkbookModule,
    ScratchGitModule,
    WorkerEnqueuerModule,
  ],
  controllers: [CliController, CliAuthController],
  providers: [CliService, CliAuthService],
  exports: [CliService, CliAuthService],
})
export class CliModule {}
