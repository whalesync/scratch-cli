import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ScratchGitClient } from './scratch-git.client';
import { ScratchGitController } from './scratch-git.controller';
import { ScratchGitService } from './scratch-git.service';

@Module({
  imports: [ConfigModule, ScratchpadConfigModule],
  controllers: [ScratchGitController],
  providers: [ScratchGitService, ScratchGitClient],
  exports: [ScratchGitService],
})
export class ScratchGitModule {}
