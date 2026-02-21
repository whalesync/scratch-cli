import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WSLogger } from 'src/logger';
import { ScratchConfigService } from '../config/scratch-config.service';
import { DbService } from '../db/db.service';

@Injectable()
export class ExampleCronService {
  constructor(
    private readonly configService: ScratchConfigService,
    private readonly dbService: DbService,
  ) {
    WSLogger.info({ source: 'ExampleCronService', message: 'Cron services initializing... 🔄' });
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  exampleCronTask() {
    WSLogger.info({
      source: 'ExampleCronService',
      message: '⏱️ Running an example cron task every 30 minutes',
    });
  }
}
