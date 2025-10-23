/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Service } from '@prisma/client';
import { DbService } from 'src/db/db.service';
import { SnapshotColumnContexts } from 'src/snapshot/types';
import { createCsvFileRecordId } from 'src/types/ids';
import { UploadsDbService } from 'src/uploads/uploads-db.service';
import { JsonSafeObject } from 'src/utils/objects';
import { Connector } from '../../connector';
import { ConnectorErrorDetails, ConnectorRecord, EntityId, TablePreview } from '../../types';
import { CsvTableSpec } from '../custom-spec-registry';
import { CsvSchemaParser } from './csv-schema-parser';

export class CsvConnector extends Connector<typeof Service.CSV> {
  service = Service.CSV;

  constructor(
    private readonly db: DbService,
    private readonly uploadsDbService: UploadsDbService,
  ) {
    super();
  }

  displayName(): string {
    return 'CSV';
  }

  public async testConnection(): Promise<void> {
    // CSV connector doesn't need to test connection since it uses PostgreSQL
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listTables(): Promise<TablePreview[]> {
    // CSV uploads don't support listing tables - each snapshot is tied to a specific upload
    // This method shouldn't be called for CSV snapshots
    throw new Error('CSV connector does not support listing tables');
  }

  async fetchTableSpec(id: EntityId): Promise<CsvTableSpec> {
    // For CSV, the uploadId is stored in remoteId array
    const uploadId = id.remoteId[0];

    // Get the upload
    const upload = await this.db.client.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`CSV upload not found: ${uploadId}`);
    }

    // Get table structure from the upload table
    const schemaName = this.uploadsDbService.getUserUploadSchema(upload.userId);
    const tableName = upload.typeId;

    const tableInfo = await this.uploadsDbService.knex(tableName).withSchema(schemaName).columnInfo();

    // Filter out metadata columns
    const dataColumns = Object.keys(tableInfo).filter(
      (col) => col !== 'remoteId' && col !== 'createdAt' && col !== 'updatedAt',
    );

    const schemaParser = new CsvSchemaParser();
    // Create column specs
    const columns = dataColumns.map((name) => {
      const colInfo = tableInfo[name];
      // Map Postgres types to our PostgresColumnType enum
      const pgType = schemaParser.getPostgresType(colInfo);
      const metadata = schemaParser.getColumnMetadata(name, colInfo);

      return {
        id: {
          wsId: name,
          remoteId: [name],
        },
        name: name,
        pgType,
        readonly: false,
        metadata,
      };
    });

    return {
      id,
      name: upload.name,
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: CsvTableSpec,
    columnContexts: SnapshotColumnContexts,
    callback: (params: { records: ConnectorRecord[]; progress?: JsonSafeObject }) => Promise<void>,
  ): Promise<void> {
    // For CSV, the uploadId is stored in remoteId array
    const uploadId = tableSpec.id.remoteId[0];

    // Get the upload
    const upload = await this.db.client.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`CSV upload not found: ${uploadId}`);
    }

    const schemaName = this.uploadsDbService.getUserUploadSchema(upload.userId);
    const tableName = upload.typeId;

    // Read records from the upload table
    const records = await this.uploadsDbService.knex(tableName).withSchema(schemaName).select('*');

    // Convert to ConnectorRecord format
    const connectorRecords: ConnectorRecord[] = records.map((record: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { remoteId, createdAt, updatedAt, ...fields } = record;
      return {
        id: remoteId as string,
        fields,
      };
    });

    // Call the callback with records, 100 at a time
    for (let i = 0; i < connectorRecords.length; i += 100) {
      await callback({ records: connectorRecords.slice(i, i + 100) });
    }
  }

  public downloadRecordDeep = undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getBatchSize(operation: 'create' | 'update' | 'delete'): number {
    return 1000;
  }

  async createRecords(
    tableSpec: CsvTableSpec,
    columnContexts: SnapshotColumnContexts,
    records: { wsId: string; fields: Record<string, unknown> }[],
  ): Promise<{ wsId: string; remoteId: string }[]> {
    // For CSV, the uploadId is stored in remoteId array
    const uploadId = tableSpec.id.remoteId[0];

    // Get the upload
    const upload = await this.db.client.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`CSV upload not found: ${uploadId}`);
    }

    // Update the upload's updatedAt timestamp to track when data was modified
    await this.db.client.upload.update({
      where: { id: uploadId },
      data: { updatedAt: new Date() },
    });

    const schemaName = this.uploadsDbService.getUserUploadSchema(upload.userId);
    const tableName = upload.typeId;

    // Insert new records with generated cfr_ IDs
    const recordsToInsert = records.map((record) => {
      const remoteId = createCsvFileRecordId();
      return {
        remoteId,
        ...record.fields,
      };
    });

    await this.uploadsDbService.knex(tableName).withSchema(schemaName).insert(recordsToInsert);

    // Return the mapping of wsId to remoteId
    return records.map((record, index) => ({
      wsId: record.wsId,
      remoteId: recordsToInsert[index].remoteId,
    }));
  }

  async updateRecords(
    tableSpec: CsvTableSpec,
    _columnContexts: SnapshotColumnContexts,
    records: { id: { wsId: string; remoteId: string }; partialFields: Record<string, unknown> }[],
  ): Promise<void> {
    // For CSV, the uploadId is stored in remoteId array
    const uploadId = tableSpec.id.remoteId[0];

    // Get the upload
    const upload = await this.db.client.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`CSV upload not found: ${uploadId}`);
    }

    // Update the upload's updatedAt timestamp to track when data was modified
    await this.db.client.upload.update({
      where: { id: uploadId },
      data: { updatedAt: new Date() },
    });

    const schemaName = this.uploadsDbService.getUserUploadSchema(upload.userId);
    const tableName = upload.typeId;

    // Update records by remoteId
    for (const record of records) {
      await this.uploadsDbService
        .knex(tableName)
        .withSchema(schemaName)
        .where({ remoteId: record.id.remoteId })
        .update(record.partialFields);
    }
  }

  async deleteRecords(tableSpec: CsvTableSpec, recordIds: { wsId: string; remoteId: string }[]): Promise<void> {
    // For CSV, the uploadId is stored in remoteId array
    const uploadId = tableSpec.id.remoteId[0];

    // Get the upload
    const upload = await this.db.client.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new Error(`CSV upload not found: ${uploadId}`);
    }

    // Update the upload's updatedAt timestamp to track when data was modified
    await this.db.client.upload.update({
      where: { id: uploadId },
      data: { updatedAt: new Date() },
    });

    const schemaName = this.uploadsDbService.getUserUploadSchema(upload.userId);
    const tableName = upload.typeId;

    // Delete records by remoteId
    const remoteIds = recordIds.map((r) => r.remoteId);
    await this.uploadsDbService.knex(tableName).withSchema(schemaName).whereIn('remoteId', remoteIds).delete();
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    return {
      userFriendlyMessage: 'An error occurred while interacting with CSV file',
      description: error instanceof Error ? error.message : String(error),
    };
  }
}
