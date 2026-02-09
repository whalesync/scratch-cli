import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { ScratchGitClient } from './scratch-git.client';
import { ScratchGitController } from './scratch-git.controller';
import { ScratchGitService } from './scratch-git.service';

@Module({
  imports: [ConfigModule, ScratchConfigModule],
  controllers: [ScratchGitController],
  providers: [ScratchGitService, ScratchGitClient],
  exports: [ScratchGitService],
})
export class ScratchGitModule {}
