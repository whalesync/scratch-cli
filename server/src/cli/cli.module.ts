import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { CliAuthController } from './cli-auth.controller';
import { CliAuthService } from './cli-auth.service';

@Module({
  imports: [ScratchpadConfigModule, AuthModule, DbModule, PosthogModule],
  controllers: [CliAuthController],
  providers: [CliAuthService],
  exports: [CliAuthService],
})
export class CliModule {}
