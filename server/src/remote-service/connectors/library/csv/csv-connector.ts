/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Service, Upload } from '@prisma/client';
import { ScratchPlanType, createCsvFileRecordId } from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { UploadsDbService } from 'src/uploads/uploads-db.service';
import { Actor } from 'src/users/types';
import { JsonSafeObject } from 'src/utils/objects';
import type { SnapshotColumnSettingsMap } from 'src/workbook/types';
import { Connector } from '../../connector';
import { ConnectorErrorDetails, ConnectorRecord, EntityId, TablePreview } from '../../types';
import { CsvTableSpec } from '../custom-spec-registry';
import { CsvSchemaParser } from './csv-schema-parser';

export class CsvConnector extends Connector<typeof Service.CSV> {
  readonly service = Service.CSV;
  static readonly displayName = 'CSV';

  constructor(
    private readonly db: DbService,
    private readonly uploadsDbService: UploadsDbService,
    private readonly userId?: string,
  ) {
    super();
  }

  public async testConnection(): Promise<void> {
    // CSV connector doesn't need to test connection since it uses PostgreSQL
  }

  async listTables(): Promise<TablePreview[]> {
    if (!this.userId) {
      throw new Error('User ID is required to list CSV uploads');
    }

    // Get all CSV uploads for the user
    const uploads = await this.db.client.upload.findMany({
      where: {
        userId: this.userId,
        type: 'CSV',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Convert uploads to TablePreview format
    return uploads.map((upload) => ({
      id: {
        wsId: upload.typeId, // Use typeId as it's the actual PostgreSQL table name
        remoteId: [upload.id],
      },
      displayName: upload.name,
    }));
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
    const schemaName = this.getSchemaName(upload);
    const tableName = upload.typeId;

    const tableInfo = await this.uploadsDbService.getKnex()(tableName).withSchema(schemaName).columnInfo();

    // Filter out metadata columns
    const dataColumns = Object.keys(tableInfo).filter(
      (col) =>
        col !== 'remoteId' && col !== '__remoteId' && col !== '__index' && col !== 'createdAt' && col !== 'updatedAt',
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
      id: {
        wsId: upload.typeId, // Use typeId as the table identifier for consistency
        remoteId: id.remoteId,
      },
      slug: upload.typeId,
      name: upload.name,
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: CsvTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
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

    const schemaName = this.getSchemaName(upload);
    const tableName = upload.typeId;

    // Read records from the upload table
    const records = await this.uploadsDbService
      .getKnex()(tableName)
      .withSchema(schemaName)
      .select('*')
      .orderBy('__index', 'asc');

    // Convert to ConnectorRecord format
    const connectorRecords: ConnectorRecord[] = records.map((record: any) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { __remoteId, __index, createdAt, updatedAt, ...fields } = record;
      return {
        id: __remoteId as string,
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
    columnSettingsMap: SnapshotColumnSettingsMap,
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

    const schemaName = this.getSchemaName(upload);
    const tableName = upload.typeId;

    // Insert new records with generated cfr_ IDs
    const recordsToInsert = records.map((record) => {
      // TEST: Throw error if ID field matches specific value
      // Will be removed soon
      // if (record.fields['ID'] === '$GSFAG$#%^F@#WQG#!$^') {
      //   throw new Error('Test error: Invalid ID value detected');
      // }

      const remoteId = createCsvFileRecordId();
      return {
        __remoteId: remoteId,
        ...record.fields,
      };
    });

    await this.uploadsDbService.getKnex()(tableName).withSchema(schemaName).insert(recordsToInsert);

    // Return the mapping of wsId to remoteId
    return records.map((record, index) => ({
      wsId: record.wsId,
      remoteId: recordsToInsert[index].__remoteId,
    }));
  }

  async updateRecords(
    tableSpec: CsvTableSpec,
    columnSettingsMap: SnapshotColumnSettingsMap,
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

    const schemaName = this.getSchemaName(upload);
    const tableName = upload.typeId;

    // Update records by remoteId
    for (const record of records) {
      // TEST: Throw error if ID field matches specific value
      // Will be removed soon
      // if (record.partialFields['ID'] === '@#$GSFAG$#%^FWQG#!$^') {
      //   throw new Error('Test error: Invalid ID value detected');
      // }

      if (Object.keys(record.partialFields).length === 0) {
        // Don't create empty update statements
        continue;
      }
      await this.uploadsDbService
        .getKnex()(tableName)
        .withSchema(schemaName)
        .where({ __remoteId: record.id.remoteId })
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

    const schemaName = this.getSchemaName(upload);
    const tableName = upload.typeId;

    // Delete records by remoteId
    const remoteIds = recordIds.map((r) => r.remoteId);
    await this.uploadsDbService.getKnex()(tableName).withSchema(schemaName).whereIn('__remoteId', remoteIds).delete();
  }

  extractConnectorErrorDetails(error: unknown): ConnectorErrorDetails {
    return {
      userFriendlyMessage: 'An error occurred while interacting with CSV file',
      description: error instanceof Error ? error.message : String(error),
    };
  }

  private getSchemaName(upload: Upload): string {
    if (!upload.organizationId) {
      throw new Error('Upload does not have an organization ID');
    }
    const actor: Actor = {
      userId: upload.userId ?? '',
      organizationId: upload.organizationId ?? '',
      subscriptionStatus: {
        status: 'active',
        planType: ScratchPlanType.FREE_PLAN,
      },
    };
    return this.uploadsDbService.getUploadSchemaName(actor);
  }
}
