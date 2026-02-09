import { Module } from '@nestjs/common';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { JobController } from './job.controller';
import { JobService } from './job.service';

@Module({
  imports: [AuthModule, DbModule, ScratchConfigModule],
  controllers: [JobController],
  providers: [JobService],
  exports: [JobService],
})
export class JobModule {}
