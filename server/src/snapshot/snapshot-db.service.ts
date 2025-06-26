import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotId } from 'src/types/ids';
import { assertUnreachable } from 'src/utils/asserts';
import { ConnectorRecord, PostgresColumnType, TableSpec } from '../remote-service/connectors/types';
import { RecordOperation } from './dto/bulk-update-records.dto';

// Design!
// There isn't a system yet for tracking versions of edits that are made to the snapshot, so instead, we use a column
// of metadata in each snapshotted table. It contains the fields that have been edited since last download, plus whether
// the record was created or deleted.
export const EDITED_FIELDS_COLUMN = '__edited_fields';

export type EditedFieldsMetadata = {
  /** Timestamps when the record was created locally. */
  __created?: string;
  /** Timestamps when the record was deleted locally. */
  __deleted?: string;
} & {
  /** The fields that have been edited since last download */
  [wsId: string]: string;
};

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
            switch (col.pgType) {
              case PostgresColumnType.TEXT:
                t.text(col.id.wsId);
                break;
              case PostgresColumnType.TEXT_ARRAY:
                t.specificType(col.id.wsId, 'text[]');
                break;
              case PostgresColumnType.NUMERIC:
                t.specificType(col.id.wsId, 'numeric');
                break;
              case PostgresColumnType.NUMERIC_ARRAY:
                t.specificType(col.id.wsId, 'numeric[]');
                break;
              case PostgresColumnType.BOOLEAN:
                t.boolean(col.id.wsId);
                break;
              case PostgresColumnType.BOOLEAN_ARRAY:
                t.specificType(col.id.wsId, 'boolean[]');
                break;
              case PostgresColumnType.JSONB:
                t.jsonb(col.id.wsId);
                break;
              default:
                assertUnreachable(col.pgType);
            }
          }
          // The metadata column for edits.
          t.jsonb(EDITED_FIELDS_COLUMN).nullable();
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

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<ConnectorRecord[]> {
    const query = this.knex(tableId).withSchema(snapshotId).select('*').orderBy('id').limit(take);

    if (cursor) {
      query.where('id', '>=', cursor);
    }

    return query;
  }

  async bulkUpdateRecords(snapshotId: SnapshotId, tableId: string, ops: RecordOperation[]): Promise<void> {
    const now = new Date().toISOString();
    await this.knex.transaction(async (trx) => {
      for (const op of ops) {
        switch (op.op) {
          case 'create':
            await trx(tableId)
              .withSchema(snapshotId)
              .insert({ ...op.data, [EDITED_FIELDS_COLUMN]: JSON.stringify({ __created: now }) });
            break;
          case 'update': {
            const newFields = Object.keys(op.data || {}).reduce(
              (acc, key) => {
                acc[key] = now;
                return acc;
              },
              {} as Record<string, string>,
            );

            const updatePayload: Record<string, any> = { ...op.data };

            // Merge the new fields into the edited fields metadata.
            if (Object.keys(newFields).length > 0) {
              updatePayload[EDITED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) || ?::jsonb`, [
                EDITED_FIELDS_COLUMN,
                JSON.stringify(newFields),
              ]);
            }

            if (Object.keys(updatePayload).length > 0) {
              await trx(tableId).withSchema(snapshotId).where('id', op.id).update(updatePayload);
            }
            break;
          }
          case 'delete':
            await trx(tableId)
              .withSchema(snapshotId)
              .where('id', op.id)
              .update({ [EDITED_FIELDS_COLUMN]: JSON.stringify({ __deleted: now }) });
            break;
        }
      }
    });
  }

  /**
   * Debug check to find connectors that are returning the wrong fields. I don't like my system for column names and
   * record conversion, and it's easy to make mistakes.
   */
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
