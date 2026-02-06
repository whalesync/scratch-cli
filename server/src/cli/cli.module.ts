import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { JobModule } from 'src/job/job.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { ConnectorAccountModule } from 'src/remote-service/connector-account/connector-account.module';
import { ScratchGitModule } from 'src/scratch-git/scratch-git.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { WorkerEnqueuerModule } from 'src/worker-enqueuer/worker-enqueuer.module';
import { CliAuthController } from './cli-auth.controller';
import { CliAuthService } from './cli-auth.service';
import { CliLinkedController } from './cli-linked.controller';
import { CliWorkbookController } from './cli-workbook.controller';

@Module({
  imports: [
    ScratchpadConfigModule,
    AuthModule,
    DbModule,
    JobModule,
    PosthogModule,
    WorkbookModule,
    ConnectorAccountModule,
    WorkerEnqueuerModule,
    ScratchGitModule,
  ],
  controllers: [CliAuthController, CliWorkbookController, CliLinkedController],
  providers: [CliAuthService],
  exports: [CliAuthService],
})
export class CliModule {}
