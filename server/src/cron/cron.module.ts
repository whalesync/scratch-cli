import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScratchpadConfigModule } from '../config/scratchpad-config.module';
import { DbModule } from '../db/db.module';
import { ExampleCronService } from './example-cron.service';

@Module({
  imports: [ScheduleModule.forRoot(), ScratchpadConfigModule, DbModule],
  providers: [ExampleCronService],
  exports: [ExampleCronService],
})
export class CronModule {}
