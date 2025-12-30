import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { WorkbookDb } from './workbook-db';

@Injectable()
export class WorkbookDbService implements OnModuleInit, OnModuleDestroy {
  public workbookDb = new WorkbookDb();

  constructor(private readonly dbService: DbService) {}

  async onModuleInit() {
    const knexInstance = this.dbService.knexClient();
    this.workbookDb.init(knexInstance);

    knexInstance.on('error', (err: Error) => {
      WSLogger.error({
        source: 'WorkbookDbService.onModuleInit',
        message: 'Unexpected error on idle client',
        error: err,
      });
    });

    try {
      await knexInstance.raw('SELECT 1');
    } catch (err) {
      WSLogger.error({
        source: 'WorkbookDbService.onModuleInit',
        message: 'Unexpected error on testing knex connection',
        error: err,
      });
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    await this.workbookDb.getKnex().destroy();
  }
}
