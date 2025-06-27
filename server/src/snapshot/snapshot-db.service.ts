import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { types } from 'pg';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { createSnapshotRecordId, SnapshotId, SnapshotRecordId } from 'src/types/ids';
import { assertUnreachable } from 'src/utils/asserts';
import { ConnectorRecord, PostgresColumnType, SnapshotRecord, TableSpec } from '../remote-service/connectors/types';
import { RecordOperation } from './dto/bulk-update-records.dto';

// Knex returns numbers as strings by default, we'll need to parse them to get native types.
types.setTypeParser(1700, 'text', parseFloat); // NUMERIC
types.setTypeParser(20, 'text', parseInt); // INT8
types.setTypeParser(23, 'text', parseInt); // INT4

// Design!
// There isn't a system yet for tracking versions of edits that are made to the snapshot, so instead, we use a column
// of metadata in each snapshotted table. It contains the fields that have been edited since last download, plus whether
// the record was created or deleted.
export const EDITED_FIELDS_COLUMN = '__edited_fields';
export const DIRTY_COLUMN = '__dirty';

export type EditedFieldsMetadata = {
  /** Timestamps when the record was created locally. */
  __created?: string;
  /** Timestamps when the record was deleted locally. */
  __deleted?: string;
} & {
  /** The fields that have been edited since last download */
  [wsId: string]: string;
};

type DbRecord = {
  wsId: SnapshotRecordId;
  id: string | null;
  [EDITED_FIELDS_COLUMN]: EditedFieldsMetadata;
  [DIRTY_COLUMN]: boolean;
  [key: string]: unknown;
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
          t.text('wsId').primary();
          t.text('id').nullable().unique();
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
          t.jsonb(EDITED_FIELDS_COLUMN).defaultTo('{}');
          t.boolean(DIRTY_COLUMN).defaultTo(false);
        });
      } else {
        // The table exists, so we need to check if we need to migrate it.
        const hasWsId = await this.knex.schema.withSchema(snapshotId).hasColumn(table.id.wsId, 'wsId');
        if (!hasWsId) {
          // Add wsId column, populate it, and set it as the new primary key.
          await this.knex.schema.withSchema(snapshotId).alterTable(table.id.wsId, (t) => {
            t.uuid('wsId').nullable();
          });
          await this.knex.raw(`UPDATE "${snapshotId}"."${table.id.wsId}" SET "wsId" = gen_random_uuid()`);
          await this.knex.schema.withSchema(snapshotId).alterTable(table.id.wsId, (t) => {
            t.dropPrimary();
          });

          await this.knex.schema.withSchema(snapshotId).alterTable(table.id.wsId, (t) => {
            t.uuid('wsId').notNullable().alter();
            t.primary(['wsId']);
            t.unique(['id']);
          });
        }

        // The table exists, so we need to check if the metadata columns exist.
        for (const col of [EDITED_FIELDS_COLUMN, DIRTY_COLUMN]) {
          const hasColumn = await this.knex.schema.withSchema(snapshotId).hasColumn(table.id.wsId, col);
          if (!hasColumn) {
            await this.knex.schema.withSchema(snapshotId).table(table.id.wsId, (t) => {
              if (col === EDITED_FIELDS_COLUMN) {
                t.jsonb(EDITED_FIELDS_COLUMN).nullable();
              } else if (col === DIRTY_COLUMN) {
                t.boolean(DIRTY_COLUMN).defaultTo(false);
              }
            });
          }
        }
      }
    }
  }

  async upsertRecords(snapshotId: SnapshotId, table: TableSpec, records: ConnectorRecord[]) {
    console.log('upsertRecords', snapshotId, table, JSON.stringify(records, null, 2));

    // Debug: Ensure the records have the right fields to catch bugs early.
    this.ensureExpectedFields(table, records);

    const upsertRecordsInput = records.map((r) => ({
      wsId: createSnapshotRecordId(), // Will be ignored on merge.
      id: r.id,
      ...r.fields,
    }));

    if (upsertRecordsInput.length === 0) {
      return;
    }

    // There might already be records in the DB. We want to pair by (remote) id and overwrite everything except the wsId.
    const columnsToUpdateOnMerge = table.columns.map((c) => c.id.wsId);

    await this.knex(table.id.wsId)
      .withSchema(snapshotId)
      .insert(upsertRecordsInput)
      .onConflict('id')
      .merge(columnsToUpdateOnMerge);
  }

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    cursor: string | undefined,
    take: number,
  ): Promise<SnapshotRecord[]> {
    const query = this.knex<DbRecord>(tableId).withSchema(snapshotId).select('*').orderBy('id').limit(take);

    if (cursor) {
      query.where('id', '>=', cursor);
    }

    return (await query).map(
      ({ wsId, id, __edited_fields, __dirty, ...fields }): SnapshotRecord => ({
        // Need to move the id columns up one level.
        id: {
          wsId,
          remoteId: id,
        },
        fields,
        __edited_fields,
        __dirty,
      }),
    );
  }

  async bulkUpdateRecords(snapshotId: SnapshotId, tableId: string, ops: RecordOperation[]): Promise<void> {
    const now = new Date().toISOString();
    await this.knex.transaction(async (trx) => {
      for (const op of ops) {
        switch (op.op) {
          case 'create':
            await trx(tableId)
              .withSchema(snapshotId)
              .insert({
                ...op.data,
                wsId: createSnapshotRecordId(),
                id: null,
                [EDITED_FIELDS_COLUMN]: JSON.stringify({ __created: now }),
                [DIRTY_COLUMN]: true,
              });
            break;
          case 'update': {
            const newFields = Object.keys(op.data || {}).reduce(
              (acc, key) => {
                acc[key] = now;
                return acc;
              },
              {} as Record<string, string>,
            );

            const updatePayload: Record<string, any> = {
              ...op.data,
              [DIRTY_COLUMN]: true,
            };

            // Merge the new fields into the edited fields metadata.
            if (Object.keys(newFields).length > 0) {
              updatePayload[EDITED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) || ?::jsonb`, [
                EDITED_FIELDS_COLUMN,
                JSON.stringify(newFields),
              ]);
            }

            if (Object.keys(updatePayload).length > 0) {
              await trx(tableId).withSchema(snapshotId).where('wsId', op.wsId).update(updatePayload);
            }
            break;
          }
          case 'delete':
            await trx(tableId)
              .withSchema(snapshotId)
              .where('wsId', op.wsId)
              .update({
                [EDITED_FIELDS_COLUMN]: JSON.stringify({ __deleted: now }),
                [DIRTY_COLUMN]: true,
              });
            break;
        }
      }
    });
  }

  async forAllDirtyRecords(
    snapshotId: SnapshotId,
    tableId: string,
    operation: 'create' | 'update' | 'delete',
    batchSize: number,
    callback: (records: SnapshotRecord[]) => Promise<void>,
  ) {
    let hasMore = true;
    while (hasMore) {
      const records = await this.knex.transaction(async (trx) => {
        const query = trx<DbRecord>(tableId)
          .withSchema(snapshotId)
          .select('*')
          .where(DIRTY_COLUMN, true)
          .limit(batchSize)
          .forUpdate()
          .skipLocked();

        // Find the records for the given operation.
        switch (operation) {
          case 'create':
            query.whereRaw(`${EDITED_FIELDS_COLUMN}->>'__created' IS NOT NULL`);
            break;
          case 'update':
            query
              .whereRaw(`${EDITED_FIELDS_COLUMN}->>'__created' IS NULL`)
              .whereRaw(`${EDITED_FIELDS_COLUMN}->>'__deleted' IS NULL`);
            break;
          case 'delete':
            query.whereRaw(`${EDITED_FIELDS_COLUMN}->>'__deleted' IS NOT NULL`);
            break;
        }

        const dbRecords = await query;
        if (dbRecords.length > 0) {
          // Mark the records as clean.
          await trx(tableId)
            .withSchema(snapshotId)
            .whereIn(
              'wsId',
              dbRecords.map((r) => r.wsId),
            )
            .update({ [DIRTY_COLUMN]: false, [EDITED_FIELDS_COLUMN]: '{}' });
        }
        return dbRecords;
      });

      if (records.length > 0) {
        await callback(
          records.map(({ wsId, id: remoteId, __edited_fields, __dirty, ...fields }) => ({
            id: { wsId, remoteId },
            __edited_fields,
            __dirty,
            fields,
          })),
        );
      } else {
        hasMore = false;
      }
    }
  }

  async updateRemoteIds(snapshotId: SnapshotId, table: TableSpec, records: { wsId: string; remoteId: string }[]) {
    await this.knex.transaction(async (trx) => {
      for (const record of records) {
        await trx(table.id.wsId).withSchema(snapshotId).where('wsId', record.wsId).update({ id: record.remoteId });
      }
    });
  }

  async deleteRecords(snapshotId: SnapshotId, table: TableSpec, wsIds: string[]) {
    await this.knex(table.id.wsId).withSchema(snapshotId).whereIn('wsId', wsIds).delete();
  }

  /**
   * Debug check to find connectors that are returning the wrong fields. I don't like my system for column names and
   * record conversion, and it's easy to make mistakes.
   */
  private ensureExpectedFields(table: TableSpec, records: ConnectorRecord[]) {
    let hasBad = false;
    const expectedFields = new Set(table.columns.map((c) => c.id.wsId));
    for (const record of records) {
      for (const [key, value] of Object.entries(record.fields)) {
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
