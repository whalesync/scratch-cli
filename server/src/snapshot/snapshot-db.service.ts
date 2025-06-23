import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotId } from 'src/types/ids';
import { ConnectorRecord, TableSpec } from '../remote-service/connectors/types';

const SOURCE_ID_COLUMN = '__source_id';

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
    await this.knex.raw('SELECT 1');
  }

  async onModuleDestroy() {
    await this.knex.destroy();
  }

  async createForSnapshot(id: SnapshotId, tables: TableSpec[]) {
    await this.knex.raw(`CREATE SCHEMA IF NOT EXISTS "${id}"`);
    for (const table of tables) {
      const tableExists = await this.knex.schema.withSchema(id).hasTable(table.pgName);
      if (!tableExists) {
        await this.knex.schema.withSchema(id).createTable(table.pgName, (t) => {
          t.text(SOURCE_ID_COLUMN).primary();
          for (const col of table.columns) {
            switch (col.type) {
              case 'number':
                t.decimal(col.pgName);
                break;
              case 'json':
                t.jsonb(col.pgName);
                break;
              case 'text':
              default:
                t.text(col.pgName);
                break;
            }
          }
        });
      }
    }
  }

  async upsertRecords(id: SnapshotId, table: TableSpec, records: ConnectorRecord[]) {
    console.log('upsertRecords', id, table, JSON.stringify(records, null, 2));
    const mappedRecords = records.map((record) => {
      const mappedRecord: Record<string, unknown> = {
        [SOURCE_ID_COLUMN]: record.id,
      };
      for (const col of table.columns) {
        if (record[col.connectorId] !== undefined) {
          mappedRecord[col.pgName] = record[col.connectorId];
        }
      }
      return mappedRecord;
    });

    if (mappedRecords.length === 0) {
      return;
    }

    await this.knex(table.pgName).withSchema(id).insert(mappedRecords).onConflict(SOURCE_ID_COLUMN).merge();
  }

  async cleanUpSnapshot(id: SnapshotId) {
    await this.knex.raw(`DROP SCHEMA IF EXISTS "${id}" CASCADE`);
  }
}
