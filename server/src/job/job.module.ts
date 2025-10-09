import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { JobController } from './job.controller';
import { JobService } from './job.service';

@Module({
  imports: [AuthModule, DbModule, ScratchpadConfigModule],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
