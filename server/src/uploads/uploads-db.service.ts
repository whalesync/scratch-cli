import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';
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
   * Gets the schema name for a user's uploads
   */
  getUserUploadSchema(userId: string): string {
    return `uploads_${userId}`;
  }

  /**
   * Ensures the user's upload schema exists
   */
  async ensureUserUploadSchema(userId: string): Promise<void> {
    const schemaName = this.getUserUploadSchema(userId);
    await this.knexInstance.raw(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    WSLogger.debug({
      source: 'UploadsDbService.ensureUserUploadSchema',
      message: 'Ensured upload schema exists',
      userId,
      schemaName,
    });
  }

  /**
   * Ensures the MdUploads table exists in the user's schema
   */
  async ensureMdUploadsTable(userId: string): Promise<void> {
    const schemaName = this.getUserUploadSchema(userId);

    // Ensure schema exists first
    await this.ensureUserUploadSchema(userId);

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
        userId,
        schemaName,
      });
    }
  }

  /**
   * Creates a CSV table in the user's upload schema
   */
  async createCsvTable(userId: string, tableId: string, columns: CsvColumnSpec[]): Promise<void> {
    const schemaName = this.getUserUploadSchema(userId);

    // Ensure schema exists first
    await this.ensureUserUploadSchema(userId);

    // Check if table already exists
    const tableExists = await this.knexInstance.schema.withSchema(schemaName).hasTable(tableId);

    if (tableExists) {
      throw new Error(`CSV table ${tableId} already exists for user ${userId}`);
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
      userId,
      schemaName,
      tableId,
      columnCount: columns.length,
    });
  }

  /**
   * Drops a CSV table from the user's upload schema
   */
  async dropCsvTable(userId: string, tableId: string): Promise<void> {
    const schemaName = this.getUserUploadSchema(userId);

    const tableExists = await this.knexInstance.schema.withSchema(schemaName).hasTable(tableId);

    if (tableExists) {
      await this.knexInstance.schema.withSchema(schemaName).dropTable(tableId);

      WSLogger.debug({
        source: 'UploadsDbService.dropCsvTable',
        message: 'Dropped CSV table',
        userId,
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
}
