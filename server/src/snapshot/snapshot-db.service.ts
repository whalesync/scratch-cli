import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { types } from 'pg';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { createSnapshotRecordId, SnapshotId, SnapshotRecordId } from 'src/types/ids';
import { assertUnreachable } from 'src/utils/asserts';
import { ViewConfig } from 'src/view/types';
import { AnyColumnSpec, AnyTableSpec } from '../remote-service/connectors/library/custom-spec-registry';
import { ConnectorRecord, PostgresColumnType, SnapshotRecord } from '../remote-service/connectors/types';
import { RecordOperation } from './dto/bulk-update-records.dto';
import { ActiveRecordSqlFilter } from './types';

// Knex returns numbers as strings by default, we'll need to parse them to get native types.
types.setTypeParser(1700, 'text', parseFloat); // NUMERIC
types.setTypeParser(20, 'text', parseInt); // INT8
types.setTypeParser(23, 'text', parseInt); // INT4

// Design!
// There isn't a system yet for tracking versions of edits that are made to the snapshot, so instead, we use a column
// of metadata in each snapshotted table. It contains the fields that have been edited since last download, plus whether
// the record was created or deleted.
export const EDITED_FIELDS_COLUMN = '__edited_fields';
// Same as the above, but for edits that are suggested by the AI.
export const SUGGESTED_FIELDS_COLUMN = '__suggested_values';

export const DIRTY_COLUMN = '__dirty';

const DEFAULT_COLUMNS = ['wsId', 'id', EDITED_FIELDS_COLUMN, SUGGESTED_FIELDS_COLUMN, DIRTY_COLUMN];

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
  [SUGGESTED_FIELDS_COLUMN]: Record<string, unknown>;
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
      debug: this.config.getDbDebug(),
    });

    this.knex.on('error', (err: Error) => {
      WSLogger.error({
        source: 'SnapshotDbService.onModuleInit',
        message: 'Unexpected error on idle client',
        error: err,
      });
    });

    await this.knex.raw('SELECT 1');
  }

  async onModuleDestroy() {
    await this.knex.destroy();
  }

  /**
   * Validates a SQL WHERE clause by running a test query against the table
   * @param snapshotId - The snapshot ID (schema name)
   * @param tableId - The table ID
   * @param sqlWhereClause - The SQL WHERE clause to validate
   * @returns Promise<string | null> - null if valid, error message if invalid
   */
  async validateSqlFilter(snapshotId: SnapshotId, tableId: string, sqlWhereClause: string): Promise<string | null> {
    try {
      // Test the SQL WHERE clause using Knex query builder with raw WHERE clause
      const testQuery = this.knex
        .select(this.knex.raw('1'))
        .from(this.knex.raw(`"${snapshotId}"."${tableId}"`))
        .whereRaw(sqlWhereClause)
        .limit(1);

      await testQuery;
      return null;
    } catch (error) {
      WSLogger.debug({
        source: 'SnapshotDbService.validateSqlFilter',
        message: 'SQL filter validation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        snapshotId,
        tableId,
        sqlWhereClause,
      });
      return error instanceof Error ? error.message : 'Unknown error';
    }
  }

  async createForSnapshot(snapshotId: SnapshotId, tables: AnyTableSpec[]) {
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
          t.jsonb(SUGGESTED_FIELDS_COLUMN).defaultTo('{}');
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

  async upsertRecords(snapshotId: SnapshotId, table: AnyTableSpec, records: ConnectorRecord[]) {
    WSLogger.debug({
      source: 'SnapshotDbService.upsertRecords',
      message: 'Upserting records',
      snapshotId,
      table,
      records,
    });

    // Debug: Ensure the records have the right fields to catch bugs early.
    this.ensureExpectedFields(table, records);

    const upsertRecordsInput = records.map((r) => ({
      wsId: createSnapshotRecordId(), // Will be ignored on merge.
      id: r.id,
      ...this.sanitizeFieldsForKnexInput(r.fields, table.columns),
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

  private sanitizeFieldsForKnexInput(
    fields: Record<string, unknown>,
    columns: AnyColumnSpec[],
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const column of columns) {
      const val = fields[column.id.wsId];
      if (val === undefined) {
        continue;
      }
      // JSON needs to be stringified, i don't know why.
      if (column.pgType === PostgresColumnType.JSONB) {
        result[column.id.wsId] = JSON.stringify(val);
      } else {
        result[column.id.wsId] = val;
      }
    }
    return result;
  }

  async listRecords(
    snapshotId: SnapshotId,
    tableId: string,
    cursor: string | undefined,
    take: number,
    view: ViewConfig | undefined,
    tableSpec?: AnyTableSpec,
    activeRecordSqlFilter?: ActiveRecordSqlFilter,
  ): Promise<{ records: SnapshotRecord[]; count: number; filteredCount: number }> {
    // const query = this.knex<DbRecord>(tableId);

    const query = this.knex<DbRecord>(tableId).withSchema(snapshotId).orderBy('id').limit(take);

    if (cursor) {
      query.where('wsId', '>=', cursor);
    }

    // Apply active record filter using SQL WHERE clauses
    if (activeRecordSqlFilter && activeRecordSqlFilter[tableId] && activeRecordSqlFilter[tableId].trim() !== '') {
      const sqlWhereClause = activeRecordSqlFilter[tableId];
      if (sqlWhereClause && sqlWhereClause.trim() !== '') {
        // Apply the SQL WHERE clause directly
        query.whereRaw(sqlWhereClause);
      }
    }

    const tableViewConfig = view?.[tableId];
    if (tableViewConfig) {
      // If table is hidden, return empty array
      if (tableViewConfig.hidden === true) {
        query.select([]);
      } else {
        // Remove hidden columns from the set of all columns
        const hiddenColumns = (tableViewConfig.columns ?? []).filter((c) => c.hidden === true).map((c) => c.wsId);
        if (hiddenColumns.length > 0) {
          // Get all available columns from the table spec and subtract the hidden ones
          const allColumns = tableSpec ? tableSpec.columns.map((c) => c.id.wsId) : [];
          const visibleColumns = allColumns.filter((col) => !hiddenColumns.includes(col));
          query.select([...DEFAULT_COLUMNS, ...visibleColumns]);
        } else {
          query.select('*');
        }
      }
    } else {
      query.select('*');
    }

    const reqult = await query;

    // Calculate counts
    let count: number;
    let filteredCount: number;

    const sqlWhereClause = activeRecordSqlFilter?.[tableId];

    if (sqlWhereClause && sqlWhereClause.trim() !== '') {
      // Count total records without filter
      const totalQuery = this.knex<DbRecord>(tableId).withSchema(snapshotId);
      const totalRecords = await totalQuery.select('wsId');
      count = totalRecords.length;

      // Count filtered records with filter
      const filteredQuery = this.knex<DbRecord>(tableId).withSchema(snapshotId);
      filteredQuery.whereRaw(sqlWhereClause);
      const filteredRecords = await filteredQuery.select('wsId');
      filteredCount = filteredRecords.length;
    } else {
      // No filter, so both counts are the same
      const totalQuery = this.knex<DbRecord>(tableId).withSchema(snapshotId);
      const totalRecords = await totalQuery.select('wsId');
      count = totalRecords.length;
      filteredCount = count;
    }

    return {
      records: reqult.map((r) => this.mapDbRecordToSnapshotRecord(r)),
      count,
      filteredCount,
    };
  }

  private mapDbRecordToSnapshotRecord(record: DbRecord): SnapshotRecord {
    const { wsId, id, __edited_fields, __suggested_values, __dirty, ...fields } = record;
    return {
      id: {
        wsId,
        remoteId: id,
      },
      fields,
      __edited_fields,
      __suggested_values,
      __dirty,
    };
  }

  async getRecord(snapshotId: SnapshotId, tableId: string, wsId: string): Promise<SnapshotRecord | null> {
    const result = await this.knex<DbRecord>(tableId).withSchema(snapshotId).where('wsId', wsId).select('*').first();

    if (!result) {
      return null;
    }

    return this.mapDbRecordToSnapshotRecord(result);
  }

  async bulkUpdateRecords(
    snapshotId: SnapshotId,
    tableId: string,
    ops: RecordOperation[],
    type: 'suggested' | 'accepted',
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.knex.transaction(async (trx) => {
      for (const op of ops) {
        switch (op.op) {
          case 'create':
            await trx(tableId)
              .withSchema(snapshotId)
              .insert({
                wsId: createSnapshotRecordId(),
                id: null,
                ...(type === 'accepted'
                  ? // Set the fields that were edited.
                    // Set the dirty column to true.
                    // Set timestamps in __edited_fields.
                    {
                      ...op.data,
                      [EDITED_FIELDS_COLUMN]: JSON.stringify({ __created: now }),
                      [DIRTY_COLUMN]: true,
                    }
                  : // No fields actually edited
                    // Set the suggested values on the __suggested_values json fied .
                    {
                      [SUGGESTED_FIELDS_COLUMN]: JSON.stringify({
                        __created: now,
                        ...op.data,
                      }),
                    }),
              });
            break;
          case 'update': {
            if (type === 'accepted') {
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
            } else {
              const updatePayload: Record<string, any> = {};
              updatePayload[SUGGESTED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) || ?::jsonb`, [
                SUGGESTED_FIELDS_COLUMN,
                JSON.stringify(op.data),
              ]);
              await trx(tableId).withSchema(snapshotId).where('wsId', op.wsId).update(updatePayload);
            }

            break;
          }
          case 'delete':
            if (type === 'accepted') {
              await trx(tableId)
                .withSchema(snapshotId)
                .where('wsId', op.wsId)
                .update({
                  [EDITED_FIELDS_COLUMN]: JSON.stringify({ __deleted: now }),
                  [DIRTY_COLUMN]: true,
                });
            } else {
              await trx(tableId)
                .withSchema(snapshotId)
                .where('wsId', op.wsId)
                .update({
                  [SUGGESTED_FIELDS_COLUMN]: JSON.stringify({ __deleted: now }),
                  [DIRTY_COLUMN]: true,
                });
            }

            break;
          case 'undelete':
            if (type === 'accepted') {
              await trx(tableId)
                .withSchema(snapshotId)
                .where('wsId', op.wsId)
                .update({ [EDITED_FIELDS_COLUMN]: JSON.stringify({}) });
            } else {
              await trx(tableId)
                .withSchema(snapshotId)
                .where('wsId', op.wsId)
                .update({ [SUGGESTED_FIELDS_COLUMN]: JSON.stringify({}) });
            }
            break;
        }
      }
    });
  }

  async acceptCellValues(
    snapshotId: SnapshotId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
    tableSpec: AnyTableSpec,
  ): Promise<void> {
    const now = new Date().toISOString();

    // Create a map of column ID to column type
    const columnTypes = new Map<string, PostgresColumnType>();
    for (const column of tableSpec.columns) {
      columnTypes.set(column.id.wsId, column.pgType);
    }

    // Group items by wsId
    const groupedByWsId = items.reduce(
      (acc, item) => {
        if (!acc[item.wsId]) {
          acc[item.wsId] = [];
        }
        acc[item.wsId].push(item.columnId);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    await this.knex.transaction(async (trx) => {
      // Process each record (wsId) separately
      for (const [wsId, columnIds] of Object.entries(groupedByWsId)) {
        const updatePayload: Record<string, any> = {};

        // For each column, copy the suggested value to the actual column with proper casting
        for (const columnId of columnIds) {
          const columnType = columnTypes.get(columnId);
          if (!columnType) {
            WSLogger.warn({
              source: 'SnapshotDbService',
              message: `Column type not found for ${columnId}, using text`,
              columnTypes: JSON.stringify(columnTypes),
            });
          }

          // Cast based on column type
          let castExpression: string;
          switch (columnType) {
            case PostgresColumnType.NUMERIC:
            case PostgresColumnType.NUMERIC_ARRAY:
              castExpression = `(??->>?)::numeric`;
              break;
            case PostgresColumnType.BOOLEAN:
            case PostgresColumnType.BOOLEAN_ARRAY:
              castExpression = `(??->>?)::boolean`;
              break;
            case PostgresColumnType.JSONB:
              castExpression = `(??->>?)::jsonb`;
              break;
            case PostgresColumnType.TEXT:
            case PostgresColumnType.TEXT_ARRAY:
            default:
              castExpression = `??->>?`;
              break;
          }

          updatePayload[columnId] = trx.raw(castExpression, [SUGGESTED_FIELDS_COLUMN, columnId]);
        }

        // Remove all suggestions for these columns using JSON deletion operator
        if (columnIds.length === 1) {
          // For single column, use the - operator
          updatePayload[SUGGESTED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) - ?`, [
            SUGGESTED_FIELDS_COLUMN,
            columnIds[0],
          ]);
        } else {
          // For multiple columns, use the - operator with an array
          updatePayload[SUGGESTED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) - ?::text[]`, [
            SUGGESTED_FIELDS_COLUMN,
            columnIds,
          ]);
        }

        // Track all edits in __edited_fields
        const editedFields = columnIds.reduce(
          (acc, columnId) => {
            acc[columnId] = now;
            return acc;
          },
          {} as Record<string, string>,
        );

        updatePayload[EDITED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) || ?::jsonb`, [
          EDITED_FIELDS_COLUMN,
          JSON.stringify(editedFields),
        ]);

        // Mark as dirty
        updatePayload[DIRTY_COLUMN] = true;

        // Execute the update for this record
        await trx(tableId).withSchema(snapshotId).where('wsId', wsId).update(updatePayload);
      }
    });
  }

  async rejectValues(
    snapshotId: SnapshotId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
  ): Promise<void> {
    // Group items by wsId
    const groupedByWsId = items.reduce(
      (acc, item) => {
        if (!acc[item.wsId]) {
          acc[item.wsId] = [];
        }
        acc[item.wsId].push(item.columnId);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    await this.knex.transaction(async (trx) => {
      // Process each record (wsId) separately
      for (const [wsId, columnIds] of Object.entries(groupedByWsId)) {
        const updatePayload: Record<string, any> = {};

        // Remove all suggestions for these columns using JSON deletion operator
        if (columnIds.length === 1) {
          // For single column, use the - operator
          updatePayload[SUGGESTED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) - ?`, [
            SUGGESTED_FIELDS_COLUMN,
            columnIds[0],
          ]);
        } else {
          // For multiple columns, use the - operator with an array
          updatePayload[SUGGESTED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) - ?::text[]`, [
            SUGGESTED_FIELDS_COLUMN,
            columnIds,
          ]);
        }

        // Execute the update for this record
        await trx(tableId).withSchema(snapshotId).where('wsId', wsId).update(updatePayload);
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
          records.map(({ wsId, id: remoteId, __edited_fields, __dirty, __suggested_values, ...fields }) => ({
            id: { wsId, remoteId },
            __edited_fields,
            __dirty,
            __suggested_values: __suggested_values ?? {},
            fields,
          })),
        );
      } else {
        hasMore = false;
      }
    }
  }

  async updateRemoteIds(snapshotId: SnapshotId, table: AnyTableSpec, records: { wsId: string; remoteId: string }[]) {
    await this.knex.transaction(async (trx) => {
      for (const record of records) {
        await trx(table.id.wsId).withSchema(snapshotId).where('wsId', record.wsId).update({ id: record.remoteId });
      }
    });
  }

  async deleteRecords(snapshotId: SnapshotId, table: AnyTableSpec, wsIds: string[]) {
    await this.knex(table.id.wsId).withSchema(snapshotId).whereIn('wsId', wsIds).delete();
  }

  /**
   * Debug check to find connectors that are returning the wrong fields. I don't like my system for column names and
   * record conversion, and it's easy to make mistakes.
   */
  private ensureExpectedFields(table: AnyTableSpec, records: ConnectorRecord[]) {
    let hasBad = false;
    const expectedFields = new Set(table.columns.map((c) => c.id.wsId));
    for (const record of records) {
      for (const [key, value] of Object.entries(record.fields)) {
        if (!expectedFields.has(key)) {
          WSLogger.error({
            source: 'SnapshotDbService.ensureExpectedFields',
            message: 'Record has unexpected field',
            recordId: record.id,
            key,
            value,
          });
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
