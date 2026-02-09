import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScratchConfigModule } from '../config/scratch-config.module';
import { DbModule } from '../db/db.module';
import { ExampleCronService } from './example-cron.service';

@Module({
  imports: [ScheduleModule.forRoot(), ScratchConfigModule, DbModule],
  providers: [ExampleCronService],
  exports: [ExampleCronService],
})
export class CronModule {}
