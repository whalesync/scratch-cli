import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { SnapshotDb } from './snapshot-db';

@Injectable()
export class SnapshotDbService implements OnModuleInit, OnModuleDestroy {
  public snapshotDb = new SnapshotDb();

  constructor(private readonly dbService: DbService) {}

  async onModuleInit() {
    const knexInstance = this.dbService.knexClient();
    this.snapshotDb.init(knexInstance);

    knexInstance.on('error', (err: Error) => {
      WSLogger.error({
        source: 'SnapshotDbService.onModuleInit',
        message: 'Unexpected error on idle client',
        error: err,
      });
    });

    try {
      await knexInstance.raw('SELECT 1');
    } catch (err) {
      WSLogger.error({
        source: 'SnapshotDbService.onModuleInit',
        message: 'Unexpected error on testing knex connection',
        error: err,
      });
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    await this.snapshotDb.getKnex().destroy();
  }
}
