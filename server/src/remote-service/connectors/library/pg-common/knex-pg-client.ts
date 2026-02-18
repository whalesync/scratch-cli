/**
 * Reusable Knex-based PostgreSQL client.
 * Ported from Whalesync's PGClient — provides schema discovery and CRUD operations
 * using Knex.js as the query builder with the pg driver.
 *
 * Designed for use by any connector that needs direct PostgreSQL access
 * (Supabase, generic Postgres, etc.).
 */
import knex, { type Knex } from 'knex';
import {
  type InformationSchemaCatalog,
  type InformationSchemaColumn,
  type PostgresEnumValue,
  type PostgresForeignKey,
  type PostgresUserDefinedType,
  type TableName,
} from './knex-pg-types';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Knex uses `?` as binding placeholders — column names containing `?` must be escaped.
 */
function escapeKnexSpecialCharacters(column: string): string {
  return column.replace(/\?/g, '\\?');
}

/** Escape an array of column names for use in Knex select(). */
function escapeColumns(columns: string[]): string[] {
  return columns.map(escapeKnexSpecialCharacters);
}

/** Escape all keys of an object for use in Knex insert/update. */
function escapeObjectKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[escapeKnexSpecialCharacters(key)] = value;
  }
  return result;
}

/** Recursively convert Date objects to ISO strings and handle arrays. */
function sanitizeFieldValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeFieldValue);
  }
  return value;
}

/** Sanitize all values in a row object. */
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[key] = sanitizeFieldValue(value);
  }
  return result;
}

/**
 * Sanitize a PostgreSQL connection string.
 * - Handles SSL parameters (strips invalid ones, adds no-verify if needed).
 * - Falls back to the original string if URL parsing fails.
 */
export function sanitizeConnectionString(connectionString: string, sslNoVerify?: boolean): string {
  try {
    const url = new URL(connectionString);
    const sslParam = url.searchParams.get('ssl');
    if (sslParam && sslParam !== 'true') {
      url.searchParams.delete('ssl');
    }
    if (sslNoVerify && !url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'no-verify');
    }
    return url.toString();
  } catch {
    return connectionString;
  }
}

// ---------------------------------------------------------------------------
// KnexPGClient
// ---------------------------------------------------------------------------

export class KnexPGClient {
  private readonly knex: Knex;

  constructor(connectionString: string, options?: { sslNoVerify?: boolean }) {
    const sanitized = sanitizeConnectionString(connectionString, options?.sslNoVerify);
    this.knex = knex({
      client: 'pg',
      connection: {
        connectionString: sanitized,
        ssl: options?.sslNoVerify ? { rejectUnauthorized: false } : undefined,
      },
      pool: { min: 0, max: 1, createTimeoutMillis: 10_000 },
    });
  }

  /** Destroy the underlying connection pool. Must be called when done. */
  async dispose(): Promise<void> {
    await this.knex.destroy();
  }

  // -------------------------------------------------------------------------
  // Connection test
  // -------------------------------------------------------------------------

  /** Run `SELECT current_database()` to verify connectivity. */
  async testQuery(): Promise<string> {
    const result = await this.knex.raw<{ rows: { current_database: string }[] }>('SELECT current_database()');
    return result.rows[0].current_database;
  }

  // -------------------------------------------------------------------------
  // Schema discovery
  // -------------------------------------------------------------------------

  /** List all schemas in the database. */
  async findAllSchemas(): Promise<InformationSchemaCatalog[]> {
    const result = await this.knex.raw<{ rows: InformationSchemaCatalog[] }>(
      'SELECT catalog_name, schema_name FROM information_schema.schemata',
    );
    return result.rows;
  }

  /** List all tables in a specific schema. */
  async findAllTablesInSchema(schema: string): Promise<TableName[]> {
    const result = await this.knex.raw<{ rows: TableName[] }>(
      'SELECT table_name, table_schema, table_type FROM information_schema.tables WHERE table_schema = ?',
      [schema],
    );
    return result.rows;
  }

  /**
   * List all tables excluding specified schemas and LIKE patterns.
   * Used by the Supabase connector to discover tables across all user schemas.
   */
  async findAllTablesExcludingSchemas(excludedSchemas: string[], excludePatterns?: string[]): Promise<TableName[]> {
    let query = this.knex('information_schema.tables')
      .select('table_name', 'table_schema', 'table_type')
      .whereNotIn('table_schema', excludedSchemas);

    if (excludePatterns) {
      for (const pattern of excludePatterns) {
        query = query.andWhereNot('table_schema', 'like', pattern);
      }
    }

    return query;
  }

  /** Get column metadata for a table. */
  async findAllColumnsInTable(schema: string, tableName: string): Promise<InformationSchemaColumn[]> {
    const result = await this.knex.raw<{ rows: InformationSchemaColumn[] }>(
      `SELECT column_name, data_type, column_default, is_updatable, is_nullable,
              domain_name, udt_name, character_maximum_length, is_identity,
              identity_increment, identity_cycle
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position`,
      [schema, tableName],
    );
    return result.rows;
  }

  /**
   * Find primary key column candidates for a table using pg_catalog.
   * Returns the column names that form the primary key.
   */
  async findPrimaryColumnCandidates(schema: string, tableName: string): Promise<string[]> {
    const result = await this.knex.raw<{ rows: { attname: string }[] }>(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid IN (
         SELECT oid FROM pg_class
         WHERE relname = ? AND relnamespace IN (
           SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = ?
         )
       )
       AND i.indisprimary`,
      [tableName, schema],
    );
    return result.rows.map((r) => r.attname);
  }

  /** Find all foreign key constraints for a table. */
  async findAllForeignKeysInTable(schema: string, tableName: string): Promise<PostgresForeignKey[]> {
    const result = await this.knex.raw<{ rows: PostgresForeignKey[] }>(
      `SELECT
         con.conname   AS constraint_name,
         n.nspname     AS table_schema,
         cl.relname    AS table_name,
         att.attname   AS column_name,
         fn.nspname    AS foreign_table_schema,
         fcl.relname   AS foreign_table_name,
         fatt.attname  AS foreign_column_name
       FROM pg_catalog.pg_constraint con
       JOIN pg_catalog.pg_class cl       ON con.conrelid = cl.oid
       JOIN pg_catalog.pg_namespace n    ON cl.relnamespace = n.oid
       JOIN pg_catalog.pg_attribute att  ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
       JOIN pg_catalog.pg_class fcl      ON con.confrelid = fcl.oid
       JOIN pg_catalog.pg_namespace fn   ON fcl.relnamespace = fn.oid
       JOIN pg_catalog.pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = ANY(con.confkey)
       WHERE con.contype = 'f'
         AND array_length(con.conkey, 1) = 1
         AND cl.relname = ? AND n.nspname = ?`,
      [tableName, schema],
    );
    return result.rows;
  }

  /** List all enum types and their values in the database. */
  async listEnumValues(): Promise<PostgresEnumValue[]> {
    const result = await this.knex.raw<{ rows: { enum_name: string; enum_value: string }[] }>(
      `SELECT pg_type.typname AS enum_name, pg_enum.enumlabel AS enum_value
       FROM pg_type
       JOIN pg_enum ON pg_type.oid = pg_enum.enumtypid`,
    );

    // Group into { enumName, enumValues[] }
    const grouped = new Map<string, string[]>();
    for (const row of result.rows) {
      const values = grouped.get(row.enum_name) ?? [];
      values.push(row.enum_value);
      grouped.set(row.enum_name, values);
    }

    return Array.from(grouped.entries()).map(([enumName, enumValues]) => ({ enumName, enumValues }));
  }

  /** List user-defined types (enums, composites, etc.) used by columns in a schema. */
  async listUserDefinedTypesInSchema(schema: string): Promise<PostgresUserDefinedType[]> {
    const result = await this.knex.raw<{ rows: PostgresUserDefinedType[] }>(
      `SELECT typname AS type_name, typtype AS type_classification
       FROM pg_type
       WHERE typname IN (
         SELECT pt.udt_name
         FROM information_schema.columns pt
         WHERE pt.table_schema = ? AND pt.data_type = 'USER-DEFINED'
       )`,
      [schema],
    );
    return result.rows;
  }

  /** Get the PostgreSQL OID for a table (used for Supabase dashboard deep-links). */
  async getTableOid(schema: string, tableName: string): Promise<number | null> {
    const result = await this.knex.raw<{ rows: { oid: number }[] }>(
      `SELECT c.oid
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = ? AND n.nspname = ?`,
      [tableName, schema],
    );
    return result.rows[0]?.oid ?? null;
  }

  // -------------------------------------------------------------------------
  // CRUD — Read
  // -------------------------------------------------------------------------

  /**
   * Paginated SELECT with ORDER BY primary key.
   * Returns sanitized row objects.
   */
  async selectAll(
    schema: string,
    tableName: string,
    columns: string[],
    primaryId: string,
    limit: number,
    offset: number,
    filter?: string,
  ): Promise<Record<string, unknown>[]> {
    const escaped = escapeColumns(columns);
    let query = this.knex(`${schema}.${tableName}`).select(escaped).orderBy(primaryId).offset(offset).limit(limit);
    if (filter) {
      query = query.whereRaw(filter);
    }
    const rows = (await query) as Record<string, unknown>[];
    return rows.map(sanitizeRow);
  }

  /** SELECT rows by primary key values. */
  async selectByIds(
    schema: string,
    tableName: string,
    columns: string[],
    primaryId: string,
    ids: (string | number)[],
  ): Promise<Record<string, unknown>[]> {
    const escaped = escapeColumns(columns);
    const rows = (await this.knex(`${schema}.${tableName}`).select(escaped).whereIn(primaryId, ids)) as Record<
      string,
      unknown
    >[];
    return rows.map(sanitizeRow);
  }

  // -------------------------------------------------------------------------
  // CRUD — Create
  // -------------------------------------------------------------------------

  /** Insert a single row, returning all columns. Strips the primary key from input. */
  async insertOne(
    schema: string,
    tableName: string,
    columns: string[],
    primaryId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const results = await this.insertMany(schema, tableName, columns, primaryId, [data]);
    return results[0];
  }

  /** Insert multiple rows in a single INSERT, returning all columns. Strips primary keys from input. */
  async insertMany(
    schema: string,
    tableName: string,
    columns: string[],
    primaryId: string,
    records: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const escaped = escapeColumns(columns);
    const insertData = records.map((record) => {
      const filtered = { ...record };
      delete filtered[primaryId];
      return escapeObjectKeys(filtered);
    });

    const rows = (await this.knex(`${schema}.${tableName}`).insert(insertData).returning(escaped)) as Record<
      string,
      unknown
    >[];

    if (rows.length !== records.length) {
      throw new KnexPGClientError(
        `Expected ${records.length} inserted rows, got ${rows.length}`,
        'INSERT_COUNT_MISMATCH',
      );
    }

    return rows.map(sanitizeRow);
  }

  // -------------------------------------------------------------------------
  // CRUD — Update
  // -------------------------------------------------------------------------

  /** Update a single row by primary key. Returns updated row or 'not_found'. */
  async updateOne(
    schema: string,
    tableName: string,
    columns: string[],
    recordId: string | number,
    primaryId: string,
    data: Record<string, unknown>,
  ): Promise<Record<string, unknown> | 'not_found'> {
    const escaped = escapeColumns(columns);
    const filteredData = { ...data };
    delete filteredData[primaryId];
    const escapedData = escapeObjectKeys(filteredData);

    const rows = (await this.knex(`${schema}.${tableName}`)
      .where(primaryId, recordId)
      .update(escapedData)
      .returning(escaped)) as Record<string, unknown>[];

    if (rows.length === 0) {
      return 'not_found';
    }
    if (rows.length > 1) {
      throw new KnexPGClientError(
        `UPDATE affected ${rows.length} rows (expected 1) for ${schema}.${tableName} where ${primaryId} = ${String(recordId)}`,
        'UPDATE_MULTIPLE_ROWS',
      );
    }

    return sanitizeRow(rows[0]);
  }

  /**
   * Update multiple rows in a transaction. Rolls back if any single update
   * affects more than 1 row.
   */
  async updateMany(
    schema: string,
    tableName: string,
    columns: string[],
    primaryId: string,
    records: { id: string | number; data: Record<string, unknown> }[],
  ): Promise<(Record<string, unknown> | 'not_found')[]> {
    const escaped = escapeColumns(columns);
    const results: (Record<string, unknown> | 'not_found')[] = [];

    await this.knex.transaction(async (trx) => {
      for (const record of records) {
        const filteredData = { ...record.data };
        delete filteredData[primaryId];
        const escapedData = escapeObjectKeys(filteredData);

        const rows = (await trx(`${schema}.${tableName}`)
          .where(primaryId, record.id)
          .update(escapedData)
          .returning(escaped)) as Record<string, unknown>[];

        if (rows.length === 0) {
          results.push('not_found');
        } else if (rows.length > 1) {
          throw new KnexPGClientError(
            `UPDATE affected ${rows.length} rows (expected 1) for ${schema}.${tableName} where ${primaryId} = ${String(record.id)}`,
            'UPDATE_MULTIPLE_ROWS',
          );
        } else {
          results.push(sanitizeRow(rows[0]));
        }
      }
    });

    return results;
  }

  // -------------------------------------------------------------------------
  // CRUD — Delete
  // -------------------------------------------------------------------------

  /** Delete a single row by primary key. Returns 'not_found' if zero rows affected. */
  async deleteOne(
    schema: string,
    tableName: string,
    recordId: string | number,
    primaryId: string,
  ): Promise<void | 'not_found'> {
    const count = await this.knex(`${schema}.${tableName}`).where(primaryId, recordId).del();

    if (count === 0) {
      return 'not_found';
    }
    if (count > 1) {
      throw new KnexPGClientError(
        `DELETE affected ${count} rows (expected 1) for ${schema}.${tableName} where ${primaryId} = ${String(recordId)}`,
        'DELETE_MULTIPLE_ROWS',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class KnexPGClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'KnexPGClientError';
  }
}
