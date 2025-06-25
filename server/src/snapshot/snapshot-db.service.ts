import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotId } from 'src/types/ids';
import { ConnectorRecord, TableSpec } from '../remote-service/connectors/types';

@Injectable()
export class SnapshotDbService implements OnModuleInit, OnModuleDestroy {
  private knex: Knex;

  constructor(private readonly config: ScratchpadConfigService) {}

  async onModuleInit() {
    this.knex = knex({
      client: 'pg',
      connection: this.config.getDatabaseUrl(),
      searchPath: ['public'],
    });

    this.knex.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
      // We are re-throwing the error here so that the client knows that the request has failed.
      // With this change, the server will no longer crash but the client will see an error.
      // throw err;
    });

    await this.knex.raw('SELECT 1');
  }

  async onModuleDestroy() {
    await this.knex.destroy();
  }

  async createForSnapshot(snapshotId: SnapshotId, tables: TableSpec[]) {
    await this.knex.raw(`CREATE SCHEMA IF NOT EXISTS "${snapshotId}"`);
    for (const table of tables) {
      const tableExists = await this.knex.schema.withSchema(snapshotId).hasTable(table.id.wsId);
      if (!tableExists) {
        await this.knex.schema.withSchema(snapshotId).createTable(table.id.wsId, (t) => {
          t.text('id').primary();
          for (const col of table.columns) {
            if (col.id.wsId === 'id') {
              continue;
            }
            switch (col.type) {
              case 'number':
                t.decimal(col.id.wsId);
                break;
              case 'json':
                t.jsonb(col.id.wsId);
                break;
              case 'text':
              default:
                t.text(col.id.wsId);
                break;
            }
          }
        });
      }
    }
  }

  async upsertRecords(snapshotId: SnapshotId, table: TableSpec, records: ConnectorRecord[]) {
    console.log('upsertRecords', snapshotId, table, JSON.stringify(records, null, 2));

    // Debug: Ensure the records have the right fields to catch bugs early.
    this.ensureExpectedFields(table, records);

    await this.knex(table.id.wsId).withSchema(snapshotId).insert(records).onConflict('id').merge();
  }

  private ensureExpectedFields(table: TableSpec, records: ConnectorRecord[]) {
    let hasBad = false;
    const expectedFields = new Set(table.columns.map((c) => c.id.wsId));
    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (!expectedFields.has(key)) {
          console.error(`Record ${record.id} has unexpected field ${key} with value ${JSON.stringify(value)}`);
          hasBad = true;
        }
      }
    }
    if (hasBad) {
      throw new Error(
        `Some records have unexpected fields, probably a bug in the connector. Expected columns: ${Array.from(
          expectedFields,
        ).join(', ')}`,
      );
    }
  }

  async cleanUpSnapshot(snapshotId: SnapshotId) {
    await this.knex.raw(`DROP SCHEMA IF EXISTS "${snapshotId}" CASCADE`);
  }
}
