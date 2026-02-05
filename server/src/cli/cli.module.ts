import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { WorkbookModule } from 'src/workbook/workbook.module';
import { CliAuthController } from './cli-auth.controller';
import { CliAuthService } from './cli-auth.service';
import { CliWorkbookController } from './cli-workbook.controller';

@Module({
  imports: [ScratchpadConfigModule, AuthModule, DbModule, PosthogModule, WorkbookModule],
  controllers: [CliAuthController, CliWorkbookController],
  providers: [CliAuthService],
  exports: [CliAuthService],
})
export class CliModule {}
