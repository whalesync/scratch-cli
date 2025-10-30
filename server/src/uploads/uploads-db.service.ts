import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
import { Actor } from 'src/users/types';
import { assertUnreachable } from 'src/utils/asserts';
import { PostgresColumnType } from '../remote-service/connectors/types';

export interface CsvColumnSpec {
  name: string;
  pgType: PostgresColumnType;
}

@Injectable()
export class UploadsDbService implements OnModuleInit, OnModuleDestroy {
  private knexInstance: Knex;

  constructor(private readonly config: ScratchpadConfigService) {}

  async onModuleInit() {
    this.knexInstance = knex({
      client: 'pg',
      connection: this.config.getDatabaseUrl(),
      searchPath: ['public'],
      debug: this.config.getDbDebug(),
    });

    this.knexInstance.on('error', (err: Error) => {
      WSLogger.error({
        source: 'UploadsDbService.onModuleInit',
        message: 'Unexpected error on idle client',
        error: err,
      });
    });

    await this.knexInstance.raw('SELECT 1');
  }

  async onModuleDestroy() {
    await this.knexInstance.destroy();
  }

  get knex(): Knex {
    return this.knexInstance;
  }
  /**
   * Gets the schema name for a organizations uploads
   */
  getUploadSchemaName(actor: Actor): string {
    return `uploads_${actor.organizationId}`;
  }

  /**
   * Ensures the user's upload schema exists
   */
  async ensureUserUploadSchema(actor: Actor): Promise<void> {
    const schemaName = this.getUploadSchemaName(actor);
    await this.knexInstance.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    WSLogger.debug({
      source: 'UploadsDbService.ensureUserUploadSchema',
      message: 'Ensured upload schema exists',
      userId: actor.userId,
      organizationId: actor.organizationId,
      schemaName,
    });
  }

  /**
   * Ensures the MdUploads table exists in the user's schema
   */
  async ensureMdUploadsTable(actor: Actor): Promise<void> {
    const schemaName = this.getUploadSchemaName(actor);

    // Ensure schema exists first
    await this.ensureUserUploadSchema(actor);

    const tableExists = await this.knexInstance.schema.withSchema(schemaName).hasTable('MdUploads');

    if (!tableExists) {
      await this.knexInstance.schema.withSchema(schemaName).createTable('MdUploads', (t) => {
        t.text('id').primary(); // MdUpload ID
        t.text('PAGE_CONTENT'); // The main markdown content
        t.jsonb('data').defaultTo('{}'); // Front matter data
        t.timestamp('createdAt').defaultTo(this.knexInstance.fn.now());
        t.timestamp('updatedAt').defaultTo(this.knexInstance.fn.now());
      });

      WSLogger.debug({
        source: 'UploadsDbService.ensureMdUploadsTable',
        message: 'Created MdUploads table',
        userId: actor.userId,
        organizationId: actor.organizationId,
        schemaName,
      });
    }
  }

  /**
   * Creates a CSV table in the user's upload schema
   */
  async createCsvTable(actor: Actor, tableId: string, columns: CsvColumnSpec[]): Promise<void> {
    const schemaName = this.getUploadSchemaName(actor);

    // Ensure schema exists first
    await this.ensureUserUploadSchema(actor);

    // Check if table already exists
    const tableExists = await this.knexInstance.schema.withSchema(schemaName).hasTable(tableId);

    if (tableExists) {
      throw new Error(`CSV table ${tableId} already exists for org
         ${actor.organizationId}`);
    }

    await this.knexInstance.schema.withSchema(schemaName).createTable(tableId, (t) => {
      t.text('remoteId').primary(); // Remote record ID (this table represents the remote source)

      for (const col of columns) {
        switch (col.pgType) {
          case PostgresColumnType.TEXT:
            t.text(col.name);
            break;
          case PostgresColumnType.TEXT_ARRAY:
            t.specificType(col.name, 'text[]');
            break;
          case PostgresColumnType.NUMERIC:
            t.specificType(col.name, 'numeric');
            break;
          case PostgresColumnType.NUMERIC_ARRAY:
            t.specificType(col.name, 'numeric[]');
            break;
          case PostgresColumnType.BOOLEAN:
            t.boolean(col.name);
            break;
          case PostgresColumnType.BOOLEAN_ARRAY:
            t.specificType(col.name, 'boolean[]');
            break;
          case PostgresColumnType.JSONB:
            t.jsonb(col.name);
            break;
          case PostgresColumnType.TIMESTAMP:
            t.timestamp(col.name, { useTz: false });
            break;
          default:
            assertUnreachable(col.pgType);
        }
      }

      t.timestamp('createdAt').defaultTo(this.knexInstance.fn.now());
    });

    WSLogger.debug({
      source: 'UploadsDbService.createCsvTable',
      message: 'Created CSV table',
      userId: actor.userId,
      organizationId: actor.organizationId,
      schemaName,
      tableId,
      columnCount: columns.length,
    });
  }

  /**
   * Drops a CSV table from the user's upload schema
   */
  async dropCsvTable(actor: Actor, tableId: string): Promise<void> {
    const schemaName = this.getUploadSchemaName(actor);

    const tableExists = await this.knexInstance.schema.withSchema(schemaName).hasTable(tableId);

    if (tableExists) {
      await this.knexInstance.schema.withSchema(schemaName).dropTable(tableId);

      WSLogger.debug({
        source: 'UploadsDbService.dropCsvTable',
        message: 'Dropped CSV table',
        userId: actor.userId,
        organizationId: actor.organizationId,
        schemaName,
        tableId,
      });
    }
  }

  /**
   * Checks if a schema exists
   */
  async schemaExists(schemaName: string): Promise<boolean> {
    const result: { rows: unknown[] } = await this.knexInstance.raw(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ?`,
      [schemaName],
    );
    return result.rows.length > 0;
  }

  /**
   * Checks if a table exists in a schema
   */
  async tableExists(schemaName: string, tableName: string): Promise<boolean> {
    return this.knexInstance.schema.withSchema(schemaName).hasTable(tableName);
  }

  /**
   * Temporary tool to migrate old style uploads to new organizations
   * DEV-8628: can be removed once migration to organizations is complete
   */
  async devToolMigrateUploadsToOrganizationId(candidates: Actor[]): Promise<{ actor: Actor; result: string }[]> {
    const results: { actor: Actor; result: string }[] = [];
    for (const candidate of candidates) {
      const oldSchemaName = `uploads_${candidate.userId}`;
      const oldSchemaExists = await this.schemaExists(oldSchemaName);
      const newSchemaName = this.getUploadSchemaName(candidate);
      if (oldSchemaExists) {
        await this.knexInstance.raw(`ALTER SCHEMA "${oldSchemaName}" RENAME TO "${newSchemaName}"`);
        results.push({ actor: candidate, result: `migrated to ${newSchemaName}` });
      } else {
        if (await this.schemaExists(newSchemaName)) {
          results.push({ actor: candidate, result: `already migrated` });
        } else {
          results.push({ actor: candidate, result: `no schema to migrate` });
        }
      }
    }
    return results;
  }
}
