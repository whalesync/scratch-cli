import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { SnapshotDb } from './snapshot-db';

@Injectable()
export class SnapshotDbService implements OnModuleInit, OnModuleDestroy {
  public snapshotDb = new SnapshotDb();

  constructor(private readonly config: ScratchpadConfigService) {}

  async onModuleInit() {
    const knexInstance = knex({
      client: 'pg',
      connection: this.config.getDatabaseUrl(),
      searchPath: ['public'],
      debug: this.config.getDbDebug(),
    });
    this.snapshotDb.init(knexInstance);

    knexInstance.on('error', (err: Error) => {
      WSLogger.error({
        source: 'SnapshotDbService.onModuleInit',
        message: 'Unexpected error on idle client',
        error: err,
      });
    });

    await knexInstance.raw('SELECT 1');
  }

  async onModuleDestroy() {
    await this.snapshotDb.knex.destroy();
  }
}
