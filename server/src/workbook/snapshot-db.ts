import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createSnapshotRecordId, SnapshotRecordId, SnapshotTableId, WorkbookId } from '@spinner/shared-types';
import { Knex } from 'knex';
import { types } from 'pg';
import { WSLogger } from 'src/logger';
import { assertUnreachable } from 'src/utils/asserts';
import { sanitizeForTableWsId } from '../remote-service/connectors/ids';
import { AnyColumnSpec, AnyTableSpec } from '../remote-service/connectors/library/custom-spec-registry';
import { ConnectorRecord, PostgresColumnType, SnapshotRecord } from '../remote-service/connectors/types';
import { RecordOperation } from './dto/bulk-update-records.dto';
import { CREATED_FIELD, DELETED_FIELD, EDITED_FIELDS_COLUMN } from './entities/reserved-coluns';

// Knex returns numbers as strings by default, we'll need to parse them to get native types.
types.setTypeParser(1700, 'text', parseFloat); // NUMERIC
types.setTypeParser(20, 'text', parseInt); // INT8
types.setTypeParser(23, 'text', parseInt); // INT4

// Design!
// There isn't a system yet for tracking versions of edits that are made to the snapshot, so instead, we use a column
// of metadata in each snapshotted table. It contains the fields that have been edited since last download, plus whether
// the record was created or deleted.
// export const EDITED_FIELDS_COLUMN = '__edited_fields';
// Same as the above, but for edits that are suggested by the AI.
export const SUGGESTED_FIELDS_COLUMN = '__suggested_values';
// Connector specific optional per record metadata
export const METADATA_COLUMN = '__metadata';

export const DIRTY_COLUMN = '__dirty';

// A special field that is used to mark a record as deleted in the EDITED_FIELDS_COLUMN and SUGGESTED_FIELDS_COLUMN
// export const DELETED_FIELD = '__deleted';

export const SEEN_COLUMN = '__seen';

export const ORIGINAL_COLUMN = '__original';
export const OLD_REMOTE_ID_COLUMN = '__old_remote_id';

// Prefixes for internal record IDs
export const UNPUBLISHED_PREFIX = 'unpublished_';
export const DELETED_PREFIX = 'deleted_';

/**
 * Represents a table for database operations.
 * Contains both the table specification (for column information) and the actual PostgreSQL table name.
 */
export type TableForDb = {
  spec: AnyTableSpec;
  tableName: string;
};

export const DEFAULT_COLUMNS = [
  'wsId',
  'id',
  EDITED_FIELDS_COLUMN,
  SUGGESTED_FIELDS_COLUMN,
  DIRTY_COLUMN,
  ORIGINAL_COLUMN,
  OLD_REMOTE_ID_COLUMN,
];

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
  [METADATA_COLUMN]: Record<string, unknown>;
  [DIRTY_COLUMN]: boolean;
  [SEEN_COLUMN]: boolean;
  [ORIGINAL_COLUMN]: Record<string, unknown> | null;
  [OLD_REMOTE_ID_COLUMN]: string | null;
  [key: string]: unknown;
};

export class SnapshotDb {
  public knex!: Knex;
  private prisma!: PrismaClient;

  init(knex: Knex, prisma: PrismaClient) {
    this.knex = knex;
    this.prisma = prisma;
  }

  /**
   * Validates a SQL WHERE clause by running a test query against the table
   * @param workbookId - The workbook ID (schema name)
   * @param tableName - The table name in PostgreSQL
   * @param sqlWhereClause - The SQL WHERE clause to validate
   * @returns Promise<string | null> - null if valid, error message if invalid
   */
  async validateSqlFilter(workbookId: WorkbookId, tableName: string, sqlWhereClause: string): Promise<string | null> {
    try {
      // Test the SQL WHERE clause using Knex query builder with raw WHERE clause
      const testQuery = this.getKnex()
        .select(this.getKnex().raw('1'))
        .from(this.getKnex().raw(`"${workbookId}"."${tableName}"`))
        .whereRaw(sqlWhereClause)
        .limit(1);

      await testQuery;
      return null;
    } catch (error) {
      WSLogger.debug({
        source: 'SnapshotDbService.validateSqlFilter',
        message: 'SQL filter validation failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        workbookId,
        tableName,
        sqlWhereClause,
      });
      return error instanceof Error ? error.message : 'Unknown error';
    }
  }

  /**
   * Marks a snapshot table as dirty (has unpublished changes)
   */
  private async markTableAsDirty(snapshotTableId: SnapshotTableId): Promise<void> {
    try {
      await this.prisma.snapshotTable.update({
        where: { id: snapshotTableId },
        data: { dirty: true },
      });
    } catch (error) {
      WSLogger.error({
        source: 'SnapshotDb.markTableAsDirty',
        message: 'Failed to mark table as dirty',
        error,
        snapshotTableId,
      });
    }
  }

  async createForWorkbook(
    workbookId: WorkbookId,
    tables: AnyTableSpec[],
    tableSpecToIdMap: Map<AnyTableSpec, SnapshotTableId>,
  ) {
    await this.getKnex().raw(`CREATE SCHEMA IF NOT EXISTS "${workbookId}"`);
    for (const table of tables) {
      const tableId = tableSpecToIdMap.get(table);
      if (!tableId) {
        throw new Error(`No table ID found for table spec: ${table.name}`);
      }

      // For v1 tables, use {tableId}_{sanitized_name} format
      const wsId = sanitizeForTableWsId(table.name);
      const tableName = `${tableId}_${wsId}`;

      const tableExists = await this.getKnex().schema.withSchema(workbookId).hasTable(tableName);
      if (!tableExists) {
        await this.getKnex()
          .schema.withSchema(workbookId)
          .createTable(tableName, (t) => {
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
                case PostgresColumnType.TIMESTAMP:
                  t.timestamp(col.id.wsId, { useTz: false });
                  break;

                default:
                  assertUnreachable(col.pgType);
              }
            }
            t.jsonb(EDITED_FIELDS_COLUMN).defaultTo('{}');
            t.jsonb(SUGGESTED_FIELDS_COLUMN).defaultTo('{}');
            t.jsonb(METADATA_COLUMN).defaultTo('{}');
            t.boolean(DIRTY_COLUMN).defaultTo(false);
            t.boolean(SEEN_COLUMN).defaultTo(true);
            t.jsonb(ORIGINAL_COLUMN).nullable();
            t.text(OLD_REMOTE_ID_COLUMN).nullable();
          });
      } else {
        // The table exists, so we need to check if we need to migrate it.
        const hasWsId = await this.getKnex().schema.withSchema(workbookId).hasColumn(tableName, 'wsId');
        if (!hasWsId) {
          // Add wsId column, populate it, and set it as the new primary key.
          await this.getKnex()
            .schema.withSchema(workbookId)
            .alterTable(tableName, (t) => {
              t.uuid('wsId').nullable();
            });
          await this.getKnex().raw(`UPDATE "${workbookId}"."${tableName}" SET "wsId" = gen_random_uuid()`);
          await this.getKnex()
            .schema.withSchema(workbookId)
            .alterTable(tableName, (t) => {
              t.dropPrimary();
            });

          await this.getKnex()
            .schema.withSchema(workbookId)
            .alterTable(tableName, (t) => {
              t.uuid('wsId').notNullable().alter();
              t.primary(['wsId']);
              t.unique(['id']);
            });
        }

        // The table exists, so we need to check if the metadata columns exist.
        for (const col of [EDITED_FIELDS_COLUMN, DIRTY_COLUMN, SEEN_COLUMN, ORIGINAL_COLUMN, OLD_REMOTE_ID_COLUMN]) {
          const hasColumn = await this.getKnex().schema.withSchema(workbookId).hasColumn(tableName, col);
          if (!hasColumn) {
            await this.getKnex()
              .schema.withSchema(workbookId)
              .table(tableName, (t) => {
                if (col === EDITED_FIELDS_COLUMN) {
                  t.jsonb(EDITED_FIELDS_COLUMN).nullable();
                } else if (col === DIRTY_COLUMN) {
                  t.boolean(DIRTY_COLUMN).defaultTo(false);
                } else if (col === SEEN_COLUMN) {
                  t.boolean(SEEN_COLUMN).defaultTo(true);
                } else if (col === ORIGINAL_COLUMN) {
                  t.jsonb(ORIGINAL_COLUMN).nullable();
                } else if (col === OLD_REMOTE_ID_COLUMN) {
                  t.text(OLD_REMOTE_ID_COLUMN).nullable();
                }
              });
          }
        }
      }
    }
  }

  /**
   * Check if a table with the given wsId exists in the workbook schema
   */
  async tableExists(workbookId: WorkbookId, tableName: string): Promise<boolean> {
    const exists = await this.getKnex().schema.withSchema(workbookId).hasTable(tableName);
    return exists;
  }

  /**
   * Drop a table from the snapshot schema if it exists
   */
  async dropTableIfExists(workbookId: WorkbookId, tableName: string): Promise<void> {
    await this.getKnex().schema.withSchema(workbookId).dropTableIfExists(tableName);
  }

  /**
   * Add a single table to an existing workbook's schema.
   * This is used when adding a new table to an existing workbook.
   */
  async addTableToWorkbook(workbookId: WorkbookId, table: TableForDb) {
    // Ensure the schema exists (it should, but just in case)
    await this.getKnex().raw(`CREATE SCHEMA IF NOT EXISTS "${workbookId}"`);

    // Check if table already exists
    const tableExists = await this.getKnex().schema.withSchema(workbookId).hasTable(table.tableName);
    if (tableExists) {
      throw new BadRequestException(`Table ${table.spec.name} already exists in workbook ${workbookId}`);
    }

    // Create the table
    await this.getKnex()
      .schema.withSchema(workbookId)
      .createTable(table.tableName, (t) => {
        t.text('wsId').primary();
        t.text('id').nullable().unique();
        for (const col of table.spec.columns) {
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
            case PostgresColumnType.TIMESTAMP:
              t.timestamp(col.id.wsId, { useTz: false });
              break;

            default:
              assertUnreachable(col.pgType);
          }
        }
        t.jsonb(EDITED_FIELDS_COLUMN).defaultTo('{}');
        t.jsonb(SUGGESTED_FIELDS_COLUMN).defaultTo('{}');
        t.jsonb(METADATA_COLUMN).defaultTo('{}');
        t.boolean(SEEN_COLUMN).defaultTo(true);
        t.boolean(DIRTY_COLUMN).defaultTo(true);
        t.jsonb(ORIGINAL_COLUMN).nullable();
        t.text(OLD_REMOTE_ID_COLUMN).nullable();
      });
  }

  async upsertRecords(workbookId: WorkbookId, table: TableForDb, records: ConnectorRecord[]) {
    WSLogger.debug({
      source: 'SnapshotDbService.upsertRecords',
      message: 'Upserting records',
      workbookId,
      table,
      records,
    });

    // Debug: Ensure the records have the right fields to catch bugs early.
    this.ensureExpectedFields(table.spec, records);

    if (records.length === 0) {
      return;
    }

    const remoteIds = records.map((r) => r.id);

    // 1. Find which of these records are already in the DB and are dirty.
    const dirtyRecordsInDb = await this.getKnex()<DbRecord>(table.tableName)
      .withSchema(workbookId)
      .whereIn('id', remoteIds)
      .andWhere(DIRTY_COLUMN, true)
      .select('*');

    const dirtyMap = new Map<string, DbRecord>();
    for (const dr of dirtyRecordsInDb) {
      if (dr.id) {
        dirtyMap.set(dr.id, dr);
      }
    }

    // 2. Prepare the payload.
    const upsertRecordsInput = records.map((r) => {
      const existingDirtyRecord = dirtyMap.get(r.id);

      if (existingDirtyRecord) {
        // MERGE LOGIC FOR DIRTY RECORDS
        const sanitizedNewFields = this.sanitizeFieldsForKnexInput(r.fields, table.spec.columns);
        const mergedFields = { ...sanitizedNewFields };
        const originalValues: Record<string, unknown> = existingDirtyRecord[ORIGINAL_COLUMN] || {};
        const editedFields = existingDirtyRecord[EDITED_FIELDS_COLUMN];

        // For each edited field, preserve the LOCAL value (from existingDirtyRecord)
        // and update __original with the REMOTE value (from r.fields/sanitizedNewFields)
        for (const colWsId of Object.keys(editedFields)) {
          if (colWsId.startsWith('__')) continue; // skip metadata like __created

          // Preserve local value
          if (existingDirtyRecord[colWsId] !== undefined) {
            mergedFields[colWsId] = existingDirtyRecord[colWsId];
          }

          // Update original value to the NEW remote value
          // We store the sanitized value in __original
          if (sanitizedNewFields[colWsId] !== undefined) {
            originalValues[colWsId] = sanitizedNewFields[colWsId];
          }
        }

        return {
          wsId: existingDirtyRecord.wsId, // Keep existing wsId
          id: r.id,
          ...mergedFields,
          [SEEN_COLUMN]: true,
          [METADATA_COLUMN]: r.metadata,
          [DIRTY_COLUMN]: true, // Still dirty
          [EDITED_FIELDS_COLUMN]: existingDirtyRecord[EDITED_FIELDS_COLUMN], // Keep edited fields
          [SUGGESTED_FIELDS_COLUMN]: existingDirtyRecord[SUGGESTED_FIELDS_COLUMN], // Keep suggestions
          [ORIGINAL_COLUMN]: JSON.stringify(originalValues),
          [OLD_REMOTE_ID_COLUMN]: existingDirtyRecord[OLD_REMOTE_ID_COLUMN],
        };
      } else {
        // CLEAN RECORD (New or Existing Clean) - Just overwrite
        const sanitizedFields = this.sanitizeFieldsForKnexInput(r.fields, table.spec.columns);
        return {
          wsId: createSnapshotRecordId(), // Will be ignored on merge if exists (but we want to use existing if possible? No, onConflict 'id' will handle it)
          // Wait, if it exists but is clean, onConflict will update. We don't need the old wsId.
          // BUT if we want to be safe, we could fetch it. But for clean records, replacing is fine.
          id: r.id,
          ...sanitizedFields,
          [SEEN_COLUMN]: true,
          [METADATA_COLUMN]: r.metadata,
          [DIRTY_COLUMN]: false,
          [EDITED_FIELDS_COLUMN]: '{}',
          [SUGGESTED_FIELDS_COLUMN]: '{}',
          [ORIGINAL_COLUMN]: JSON.stringify(sanitizedFields), // Store original values from remote
          [OLD_REMOTE_ID_COLUMN]: null,
        };
      }
    });

    // There might already be records in the DB. We want to pair by (remote) id and overwrite everything except the wsId.
    const columnsToUpdateOnMerge = [
      ...table.spec.columns.map((c) => c.id.wsId),
      METADATA_COLUMN,
      SEEN_COLUMN,
      DIRTY_COLUMN,
      EDITED_FIELDS_COLUMN,
      SUGGESTED_FIELDS_COLUMN,
      ORIGINAL_COLUMN,
      OLD_REMOTE_ID_COLUMN,
    ];

    await this.getKnex()(table.tableName)
      .withSchema(workbookId)
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

  private getSelectColumns(tableSpec?: AnyTableSpec, hiddenColumns?: string[]): string | string[] {
    if (hiddenColumns && hiddenColumns.length > 0) {
      // Remove hidden columns from the set of all columns
      // Get all available columns from the table spec and subtract the hidden ones
      const allColumns = tableSpec ? tableSpec.columns.map((c) => c.id.wsId) : [];
      const visibleColumns = allColumns.filter((col) => !hiddenColumns.includes(col));
      return [...DEFAULT_COLUMNS, ...visibleColumns];
    } else {
      return '*';
    }
  }

  async listRecords(
    workbookId: WorkbookId,
    tableName: string,
    skip: number,
    take: number,
    tableSpec?: AnyTableSpec,
    activeRecordSqlFilter?: string | null,
    hiddenColumns?: string[],
  ): Promise<{ records: SnapshotRecord[]; count: number; filteredCount: number; skip: number; take: number }> {
    const query = this.getKnex()<DbRecord>(tableName)
      .withSchema(workbookId)
      .orderBy('id', 'asc')
      .limit(take)
      .offset(skip);

    // Apply active record filter using SQL WHERE clauses
    if (activeRecordSqlFilter && activeRecordSqlFilter.trim() !== '') {
      query.whereRaw(activeRecordSqlFilter);
    }

    query.select(this.getSelectColumns(tableSpec, hiddenColumns));

    const result = await query;

    // Calculate counts
    let count: number;
    let filteredCount: number;

    if (activeRecordSqlFilter && activeRecordSqlFilter.trim() !== '') {
      // Count total records without filter
      const totalQuery = this.getKnex()<DbRecord>(tableName).withSchema(workbookId);
      const totalRecords = await totalQuery.count('* as count');
      count = parseInt(String(totalRecords[0].count), 10);

      // Count filtered records with filter
      const filteredQuery = this.getKnex()<DbRecord>(tableName).withSchema(workbookId);
      filteredQuery.whereRaw(activeRecordSqlFilter);
      const filteredRecords = await filteredQuery.count('* as count');
      filteredCount = parseInt(String(filteredRecords[0].count), 10);
    } else {
      // No filter, so both counts are the same
      const totalQuery = this.getKnex()<DbRecord>(tableName).withSchema(workbookId);
      const totalRecords = await totalQuery.count('* as count');
      count = parseInt(String(totalRecords[0].count), 10);
      filteredCount = count;
    }

    const records = result.map((r) => this.mapDbRecordToSnapshotRecord(r, hiddenColumns));

    return {
      records,
      count,
      filteredCount,
      skip,
      take,
    };
  }

  private mapDbRecordToSnapshotRecord(record: DbRecord, hiddenColumns?: string[]): SnapshotRecord {
    const {
      wsId,
      id,
      __edited_fields,
      __suggested_values,
      __dirty,
      __metadata,
      __old_remote_id,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      __original,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      __seen,
      ...fields
    } = record;

    let editedFields = __edited_fields;
    let suggestedValues = __suggested_values;

    let metadata = __metadata;

    if (hiddenColumns && hiddenColumns.length > 0) {
      // Filter hidden columns from __edited_fields
      if (editedFields) {
        editedFields = { ...editedFields };
        for (const col of hiddenColumns) {
          delete editedFields[col];
        }
      }

      // Filter hidden columns from __suggested_values
      if (suggestedValues) {
        suggestedValues = { ...suggestedValues };
        for (const col of hiddenColumns) {
          delete suggestedValues[col];
        }
      }

      // Filter hidden columns from __metadata
      if (metadata) {
        metadata = { ...metadata };
        for (const col of hiddenColumns) {
          delete metadata[col];
        }
      }
    }

    return {
      id: {
        wsId,
        remoteId: id,
      },
      fields,
      __edited_fields: editedFields,
      __suggested_values: suggestedValues,
      __metadata: metadata,
      __dirty,
      __old_remote_id,
    };
  }

  async getRecord(workbookId: WorkbookId, tableName: string, wsId: string): Promise<SnapshotRecord | null> {
    const result = await this.getKnex()<DbRecord>(tableName)
      .withSchema(workbookId)
      .where('wsId', wsId)
      .select('*')
      .first();

    if (!result) {
      return null;
    }

    return this.mapDbRecordToSnapshotRecord(result);
  }

  async getRecordsByIds(
    workbookId: WorkbookId,
    tableName: string,
    wsIds: string[],
    tableSpec?: AnyTableSpec,
    hiddenColumns?: string[],
  ): Promise<SnapshotRecord[]> {
    if (wsIds.length === 0) {
      return [];
    }

    const query = this.getKnex()<DbRecord>(tableName).withSchema(workbookId).whereIn('wsId', wsIds);

    query.select(this.getSelectColumns(tableSpec, hiddenColumns));

    const results = await query;

    return results.map((result) => this.mapDbRecordToSnapshotRecord(result, hiddenColumns));
  }

  async bulkUpdateRecords(
    workbookId: WorkbookId,
    snapshotTableId: SnapshotTableId,
    tableName: string,
    ops: RecordOperation[],
    type: 'suggested' | 'accepted',
    tableSpec: AnyTableSpec,
  ): Promise<void> {
    const readOnlyColumns = new Set(tableSpec.columns.filter((c) => c.readonly).map((c) => c.id.wsId));

    // Create a map of column ID to column type for proper parsing
    const columnTypes = new Map<string, PostgresColumnType>();
    for (const column of tableSpec.columns) {
      columnTypes.set(column.id.wsId, column.pgType);
    }

    // Helper to parse JSON strings into objects/arrays for Knex to handle efficiently
    const parseJsonFields = (data: Record<string, unknown> | undefined): Record<string, unknown> => {
      const parsed = { ...data };
      for (const [key, value] of Object.entries(parsed)) {
        const colType = columnTypes.get(key);
        // Only parse if it's a JSON-type column and the value is a string
        if (
          (colType === PostgresColumnType.JSONB || colType === PostgresColumnType.TEXT_ARRAY) &&
          typeof value === 'string'
        ) {
          try {
            parsed[key] = JSON.parse(value);
          } catch (error) {
            WSLogger.warn({
              source: 'SnapshotDb.bulkUpdateRecords',
              message: `Failed to parse JSON for column ${key}, keeping as string`,
              error: error instanceof Error ? error.message : String(error),
            });
            // Keep original string value if parse fails
          }
        }
      }
      return parsed;
    };

    for (const op of ops) {
      if (op.op === 'create' || op.op === 'update') {
        if (!op.data) continue;

        // Parse JSON strings to objects so Knex can handle them efficiently
        op.data = parseJsonFields(op.data);

        for (const field of Object.keys(op.data)) {
          if (readOnlyColumns.has(field)) {
            if (type === 'accepted') {
              if (!op.data[field]) {
                // Drop nulls and undefiened
                delete op.data[field];
              } else {
                throw new BadRequestException(`Cannot modify read-only column: ${field}`);
              }
            } else {
              delete op.data[field];
            }
          }
        }
      }
    }
    const now = new Date().toISOString();
    await this.getKnex().transaction(async (trx) => {
      for (const op of ops) {
        switch (op.op) {
          case 'create': {
            // Generate a temporary remote ID for new records until they're pushed
            const snapshotRecordId = createSnapshotRecordId();
            const tempRemoteId = `${UNPUBLISHED_PREFIX}${snapshotRecordId}`;
            await trx(tableName)
              .withSchema(workbookId)
              .insert({
                wsId: snapshotRecordId,
                id: tempRemoteId,
                ...(type === 'accepted'
                  ? // Set the fields that were edited.
                    // Set the dirty column to true.
                    // Set timestamps in __edited_fields.
                    // op.data already has parsed JSON objects, Knex will handle serialization
                    {
                      ...op.data,
                      [EDITED_FIELDS_COLUMN]: JSON.stringify({ __created: now }),
                      [DIRTY_COLUMN]: true,
                    }
                  : // No fields actually edited
                    // Set the suggested values on the __suggested_values json field.
                    {
                      [EDITED_FIELDS_COLUMN]: JSON.stringify({ __created: now }),
                      [SUGGESTED_FIELDS_COLUMN]: JSON.stringify({
                        __created: now,
                        ...op.data,
                      }),
                    }),
              });
            break;
          }
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
                // op.data already has parsed JSON objects, Knex will handle serialization
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
                await trx(tableName).withSchema(workbookId).where('wsId', op.wsId).update(updatePayload);
              }
            } else {
              const updatePayload: Record<string, any> = {};
              updatePayload[SUGGESTED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) || ?::jsonb`, [
                SUGGESTED_FIELDS_COLUMN,
                JSON.stringify(op.data),
              ]);
              await trx(tableName).withSchema(workbookId).where('wsId', op.wsId).update(updatePayload);
            }

            break;
          }
          case 'delete': {
            // First, check if the record has a temporary remote ID or is a discovered delete
            const record = await trx(tableName)
              .withSchema(workbookId)
              .where('wsId', op.wsId)
              .first<{ id: string | null; wsId: string }>();

            if (record?.id?.startsWith(UNPUBLISHED_PREFIX) || record?.id?.startsWith(DELETED_PREFIX)) {
              // Record hasn't been synced yet (unpublished_) or is a discovered delete (deleted_)
              // Delete it immediately - no need to track for publishing
              await trx(tableName).withSchema(workbookId).where('wsId', op.wsId).delete();
            } else {
              // Record has been synced, mark it for deletion on next publish
              if (type === 'accepted') {
                // For user-initiated accepted deletions, just set __deleted field
                // Keep the remote ID so we can push the delete on next publish
                await trx(tableName)
                  .withSchema(workbookId)
                  .where('wsId', op.wsId)
                  .update({
                    [EDITED_FIELDS_COLUMN]: JSON.stringify({ __deleted: now }),
                    [DIRTY_COLUMN]: true,
                  });
              } else {
                await trx(tableName)
                  .withSchema(workbookId)
                  .where('wsId', op.wsId)
                  .update({
                    [SUGGESTED_FIELDS_COLUMN]: JSON.stringify({ __deleted: now }),
                    [DIRTY_COLUMN]: true,
                  });
              }
            }

            break;
          }
          case 'undelete':
            if (type === 'accepted') {
              await trx(tableName)
                .withSchema(workbookId)
                .where('wsId', op.wsId)
                .update({ [EDITED_FIELDS_COLUMN]: JSON.stringify({}) });
            } else {
              await trx(tableName)
                .withSchema(workbookId)
                .where('wsId', op.wsId)
                .update({ [SUGGESTED_FIELDS_COLUMN]: JSON.stringify({}) });
            }
            break;
        }
      }
    });

    // Mark table as dirty if any records were modified with accepted changes
    if (type === 'accepted' && ops.length > 0) {
      await this.markTableAsDirty(snapshotTableId);
    }
  }

  async acceptCellValues(
    workbookId: WorkbookId,
    snapshotTableId: SnapshotTableId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
    tableSpec: AnyTableSpec,
  ): Promise<number> {
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

    const numRecordsUpdated = await this.getKnex().transaction(async (trx) => {
      let count = 0;
      // Process each record (wsId) separately
      for (const [wsId, columnIds] of Object.entries(groupedByWsId)) {
        const updatePayload: Record<string, any> = {};

        // For each column, copy the suggested value to the actual column with proper casting
        for (const columnId of columnIds) {
          if (columnId === DELETED_FIELD || columnId === CREATED_FIELD) {
            // ignore the deleted field, it is handled separately
            continue;
          }

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
              // Retrieve <columnId> as a string from __suggested_values and parse it as a numeric
              castExpression = `(??->>?)::numeric`;
              break;
            case PostgresColumnType.NUMERIC_ARRAY:
              // Retrieve <columnId> as a string from __suggested_values and parse it as JSON, then turn it into individual values, parse each as numeric, then turn it back into an array
              castExpression = `ARRAY(SELECT (jsonb_array_elements((??->>?)::jsonb))::text::numeric)`;
              break;
            case PostgresColumnType.BOOLEAN:
              // Retrieve <columnId> as a string from __suggested_values and parse it as a boolean
              castExpression = `(??->>?)::boolean`;
              break;
            case PostgresColumnType.BOOLEAN_ARRAY:
              // Retrieve <columnId> as a string from __suggested_values and parse it as JSON, then turn it into individual values, parse each as boolean, then turn it back into an array
              castExpression = `ARRAY(SELECT (jsonb_array_elements((??->>?)::jsonb))::text::boolean)`;
              break;
            case PostgresColumnType.JSONB:
              // Retrieve <columnId> as a string from __suggested_values and parse it as JSON
              castExpression = `(??->>?)::jsonb`;
              break;
            case PostgresColumnType.TEXT_ARRAY:
              // Retrieve <columnId> as a string from __suggested_values and parse it as JSON, then turn it into individual values, then turn it back into an array
              castExpression = `ARRAY(SELECT jsonb_array_elements_text((??->>?)::jsonb))`;
              break;
            case PostgresColumnType.TEXT:
            default:
              // Retrieve <columnId> as a string from __suggested_values
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

        if (columnIds.includes(DELETED_FIELD)) {
          editedFields[DELETED_FIELD] = now;
        }
        if (columnIds.includes(CREATED_FIELD)) {
          editedFields[CREATED_FIELD] = now;
        }

        updatePayload[EDITED_FIELDS_COLUMN] = trx.raw(`COALESCE(??, '{}'::jsonb) || ?::jsonb`, [
          EDITED_FIELDS_COLUMN,
          JSON.stringify(editedFields),
        ]);

        // Mark as dirty
        updatePayload[DIRTY_COLUMN] = true;

        // Execute the update for this record
        await trx(tableId).withSchema(workbookId).where('wsId', wsId).update(updatePayload);
        count++;
      }
      return count;
    });

    // Mark table as dirty if any records were updated
    if (numRecordsUpdated > 0) {
      await this.markTableAsDirty(snapshotTableId);
    }

    return numRecordsUpdated;
  }

  async rejectValues(
    workbookId: WorkbookId,
    tableId: string,
    items: { wsId: string; columnId: string }[],
  ): Promise<number> {
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

    return await this.getKnex().transaction(async (trx) => {
      let numRecordsUpdated = 0;
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
        await trx(tableId).withSchema(workbookId).where('wsId', wsId).update(updatePayload);
        numRecordsUpdated++;
      }
      return numRecordsUpdated;
    });
  }

  /**
   * Handle records that were deleted remotely but have local edits.
   * @param recordWsIds Optional filter by specific record IDs. If not provided, filters by presence of __old_remote_id
   * @param action 'create' - convert to unpublished_ records, 'delete' - delete them
   */
  async resolveRemoteDeletesWithLocalEdits(
    workbookId: WorkbookId,
    tableName: string,
    recordWsIds: string[] | undefined,
    action: 'create' | 'delete',
  ): Promise<number> {
    return await this.getKnex().transaction(async (trx) => {
      // Build base query with filters
      let query = trx(tableName).withSchema(workbookId);

      if (recordWsIds && recordWsIds.length > 0) {
        // Filter by specific record IDs
        query = query.whereIn('wsId', recordWsIds);
      } else {
        // Filter by presence of old remote ID (discovered deletes)
        query = query.whereNotNull(OLD_REMOTE_ID_COLUMN);
      }

      if (action === 'delete') {
        // Delete all matching records in one query
        const count = await query.delete();
        return count;
      } else {
        // action === 'create'
        // Convert to unpublished records by updating the ID with unpublished_ prefix
        // Use raw SQL to concatenate the prefix with wsId
        const count = await query.update({
          id: this.getKnex().raw(`'${UNPUBLISHED_PREFIX}' || ??`, ['wsId']),
          // Keep the old remote ID in __old_remote_id (it should already be set, but this ensures it)
        });
        return count;
      }
    });
  }

  async countExpectedOperations(
    workbookId: WorkbookId,
    tableName: string,
  ): Promise<{ creates: number; updates: number; deletes: number }> {
    const result = await this.getKnex().transaction(async (trx) => {
      const query = trx<DbRecord>(tableName).withSchema(workbookId).where(DIRTY_COLUMN, true);

      // We can't easily do a single query with count(*) and filters because the filters are on JSON fields.
      // But we can do a single query that sums up the conditions.
      // Postgres allows casting booleans to integers (1 for true, 0 for false) but it's safer to use CASE WHEN.

      const counts = await query
        .sum({
          creates: trx.raw(`CASE WHEN ??->>'__created' IS NOT NULL THEN 1 ELSE 0 END`, [EDITED_FIELDS_COLUMN]),
          deletes: trx.raw(`CASE WHEN ??->>'__deleted' IS NOT NULL THEN 1 ELSE 0 END`, [EDITED_FIELDS_COLUMN]),
          updates: trx.raw(`CASE WHEN ??->>'__created' IS NULL AND ??->>'__deleted' IS NULL THEN 1 ELSE 0 END`, [
            EDITED_FIELDS_COLUMN,
            EDITED_FIELDS_COLUMN,
          ]),
        })
        .first();

      return {
        creates: parseInt((counts?.creates as string) || '0', 10),
        updates: parseInt((counts?.updates as string) || '0', 10),
        deletes: parseInt((counts?.deletes as string) || '0', 10),
      };
    });

    return result;
  }

  async forAllDirtyRecords(
    workbookId: WorkbookId,
    tableName: string,
    operation: 'create' | 'update' | 'delete',
    batchSize: number,
    callback: (records: SnapshotRecord[], trx: Knex.Transaction) => Promise<void>,
    markAsClean: boolean,
  ): Promise<number> {
    let processedCount = 0;
    // Process all dirty records in a single transaction to avoid pagination issues
    await this.getKnex().transaction(async (trx) => {
      const query = trx<DbRecord>(tableName)
        .withSchema(workbookId)
        .select('*')
        .where(DIRTY_COLUMN, true)
        .orderBy('wsId')
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

      const allDbRecords = await query;
      processedCount = allDbRecords.length;

      if (allDbRecords.length > 0) {
        // Process records in batches
        for (let i = 0; i < allDbRecords.length; i += batchSize) {
          const batch = allDbRecords.slice(i, i + batchSize);

          await callback(
            batch.map(
              ({
                wsId,
                id: remoteId,
                __edited_fields,
                __dirty,
                __suggested_values,
                __metadata,
                __seen,
                __original,
                __old_remote_id,
                ...fields
              }) => ({
                id: { wsId, remoteId },
                __edited_fields,
                __dirty,
                __seen,
                __suggested_values: __suggested_values ?? {},
                fields,
                __metadata,
                __original,
                __old_remote_id,
              }),
            ),
            trx,
          );
        }

        if (markAsClean) {
          // Mark all processed records as clean
          await trx(tableName)
            .withSchema(workbookId)
            .whereIn(
              'wsId',
              allDbRecords.map((r) => r.wsId),
            )
            .update({ [DIRTY_COLUMN]: false, [EDITED_FIELDS_COLUMN]: '{}' });
        }
      }
    });
    return processedCount;
  }

  async updateRemoteIds(
    workbookId: WorkbookId,
    table: TableForDb,
    records: { wsId: string; remoteId: string }[],
    trx: Knex.Transaction,
  ) {
    for (const record of records) {
      await trx(table.tableName).withSchema(workbookId).where('wsId', record.wsId).update({ id: record.remoteId });
    }
  }

  async deleteRecords(workbookId: WorkbookId, tableName: string, wsIds: string[], trx: Knex.Transaction) {
    await trx(tableName).withSchema(workbookId).whereIn('wsId', wsIds).delete();
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

  async cleanUpSnapshots(workbookId: WorkbookId) {
    await this.getKnex().raw(`DROP SCHEMA IF EXISTS "${workbookId}" CASCADE`);
  }

  async addColumn(
    workbookId: WorkbookId,
    tableName: string,
    config: { columnId: string; columnType: PostgresColumnType },
  ): Promise<void> {
    // Check if table already exists
    const tableExists = await this.getKnex().schema.withSchema(workbookId).hasTable(tableName);
    if (!tableExists) {
      throw new Error(`Table ${tableName} does not exist in workbook ${workbookId}`);
    }

    // Check if column already exists
    const columnExists = await this.getKnex().schema.withSchema(workbookId).hasColumn(tableName, config.columnId);
    if (columnExists) {
      throw new Error(`Column ${config.columnId} already exists in table ${tableName} in workbook ${workbookId}`);
    }

    // Add the column to the workbook table
    await this.getKnex()
      .schema.withSchema(workbookId)
      .alterTable(tableName, (t) => {
        t.specificType(config.columnId, config.columnType);
      });
  }

  /**
   * Remove a scratch column from a workbook table.
   * @param workbookId - The workbook ID (schema name)
   * @param tableName - The table ID (table name)
   * @param columnId - The column ID (column name)
   */
  async removeColumn(workbookId: WorkbookId, tableName: string, columnId: string): Promise<void> {
    // Check if column exists
    const columnExists = await this.getKnex().schema.withSchema(workbookId).hasColumn(tableName, columnId);
    if (!columnExists) {
      throw new Error(`Column ${columnId} does not exist in table ${tableName} in workbook ${workbookId}`);
    }

    // Remove the column from the workbook table
    await this.getKnex()
      .schema.withSchema(workbookId)
      .alterTable(tableName, (t) => {
        t.dropColumn(columnId);
      });
  }

  public getKnex(): Knex {
    if (!this.knex) {
      throw new Error('Expected knex to not be undefined');
    }
    return this.knex;
  }

  async handleUnseenRecords(workbookId: WorkbookId, tableName: string): Promise<{ hadDirtyRecords: boolean }> {
    const batchSize = 1000;
    const now = new Date().toISOString();
    let hadDirtyRecords = false;

    while (true) {
      // Find records where __seen is false (not seen during this sync)
      const recordsToProcess = await this.getKnex()<DbRecord>(tableName)
        .withSchema(workbookId)
        .where(SEEN_COLUMN, false)
        .limit(batchSize)
        .select('wsId', 'id', DIRTY_COLUMN, EDITED_FIELDS_COLUMN);

      if (recordsToProcess.length === 0) {
        break;
      }

      const cleanWsIds: string[] = [];
      const dirtyRecordsToConvert: Pick<DbRecord, 'wsId' | 'id' | typeof DIRTY_COLUMN | typeof EDITED_FIELDS_COLUMN>[] =
        [];
      const dirtyRecordsToDelete: string[] = [];

      for (const r of recordsToProcess) {
        if (r[DIRTY_COLUMN]) {
          const editedFields = r[EDITED_FIELDS_COLUMN] || {};
          // If the record is marked as deleted locally, delete it completely (both sides agree to delete)
          if (editedFields.__deleted) {
            dirtyRecordsToDelete.push(r.wsId);
          } else {
            // Record has local edits that are not deletions - convert to discovered delete
            dirtyRecordsToConvert.push(r);
          }
        } else {
          cleanWsIds.push(r.wsId);
        }
      }

      // Track if we found any dirty records with conflicting changes (not deletions)
      if (dirtyRecordsToConvert.length > 0) {
        hadDirtyRecords = true;
      }

      await this.getKnex().transaction(async (trx) => {
        // 1. Delete clean records
        if (cleanWsIds.length > 0) {
          await this.deleteRecords(workbookId, tableName, cleanWsIds, trx);
        }

        // 2. Delete dirty records that are also marked as deleted locally
        if (dirtyRecordsToDelete.length > 0) {
          await this.deleteRecords(workbookId, tableName, dirtyRecordsToDelete, trx);
        }

        // 3. Convert dirty records with non-deletion edits to discovered deletes
        for (const dr of dirtyRecordsToConvert) {
          const editedFields = dr[EDITED_FIELDS_COLUMN] || {};
          // Add __created to edited fields if not present
          if (!editedFields.__created) {
            editedFields.__created = now;
          }

          // Use deleted_ prefix for records that were deleted remotely but have local edits
          const deletedId = `${DELETED_PREFIX}${dr.wsId}`;
          await trx(tableName)
            .withSchema(workbookId)
            .where('wsId', dr.wsId)
            .update({
              id: deletedId, // Use deleted_ prefix
              [OLD_REMOTE_ID_COLUMN]: dr.id, // Save old remote ID
              [SEEN_COLUMN]: true, // Mark as seen so we don't process it again
              [EDITED_FIELDS_COLUMN]: JSON.stringify(editedFields),
              [DIRTY_COLUMN]: true, // Ensure it stays dirty
            });
        }
      });

      // If we got fewer records than batch size, we're done
      if (recordsToProcess.length < batchSize) {
        break;
      }
    }

    return { hadDirtyRecords };
  }
}
