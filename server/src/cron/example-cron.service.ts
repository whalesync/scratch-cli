import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WSLogger } from 'src/logger';
import { ScratchpadConfigService } from '../config/scratchpad-config.service';
import { DbService } from '../db/db.service';

@Injectable()
export class ExampleCronService {
  constructor(
    private readonly configService: ScratchpadConfigService,
    private readonly dbService: DbService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  exampleCronTask() {
    WSLogger.info({
      source: 'ExampleCronService',
      message: 'Running an example cron task once per day',
    });
  }
}
