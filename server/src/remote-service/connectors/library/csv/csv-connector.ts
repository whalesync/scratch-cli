import { ConnectorAccount, Service } from '@prisma/client';
import { CsvFileService } from 'src/csv-file/csv-file.service';
import { Connector } from '../../connector';
import { ConnectorRecord, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { CsvTableSpec } from '../custom-spec-registry';
import { parseCsv } from './csv-parser';

export class CsvConnector extends Connector<typeof Service.CSV> {
  service = Service.CSV;

  constructor(private readonly csvFileService: CsvFileService) {
    super();
  }

  public async testConnection(): Promise<void> {
    // CSV connector doesn't need to test connection since it uses local files
  }

  async listTables(account: ConnectorAccount): Promise<TablePreview[]> {
    // Get all CSV files for the user
    const csvFiles = await this.csvFileService.findAll(account.userId);

    return csvFiles.map((csvFile) => ({
      id: {
        wsId: csvFile.id,
        remoteId: [csvFile.id],
      },
      displayName: csvFile.name,
    }));
  }

  async fetchTableSpec(id: EntityId, account: ConnectorAccount): Promise<CsvTableSpec> {
    // Get the CSV file
    const csvFile = await this.csvFileService.findOne(id.wsId, account.userId);
    if (!csvFile) {
      throw new Error(`CSV file not found: ${id.wsId}`);
    }

    // Parse the CSV to get headers
    const csvData = parseCsv(csvFile.body);

    // Create column specs from headers
    const columns = csvData.headers.map((header, index) => ({
      id: {
        wsId: header,
        remoteId: [header],
      },
      name: header,
      pgType: PostgresColumnType.TEXT, // All CSV fields are strings
      markdown: header.toLowerCase().endsWith('_md') || header.toLowerCase().endsWith('.md') ? true : undefined,
      readonly: index === 0 && (header.toLowerCase() === 'id' || header.toLowerCase().endsWith('_id')), // First field is readonly if it is the identity field
    }));

    return {
      id,
      name: csvFile.name,
      columns,
    };
  }

  async downloadTableRecords(
    tableSpec: CsvTableSpec,
    callback: (records: ConnectorRecord[]) => Promise<void>,
    account: ConnectorAccount,
  ): Promise<void> {
    // Get the CSV file
    const csvFile = await this.csvFileService.findOne(tableSpec.id.wsId, account.userId);
    if (!csvFile) {
      throw new Error(`CSV file not found: ${tableSpec.id.wsId}`);
    }

    // Parse the CSV
    const csvData = parseCsv(csvFile.body);

    // Convert to ConnectorRecord format
    const records: ConnectorRecord[] = csvData.records.map((record) => ({
      id: record.fields[csvData.headers[0]] || record.id, // Use first field as ID, fallback to row number
      fields: record.fields,
    }));

    // Call the callback with records, 100 at a time
    for (let i = 0; i < records.length; i += 100) {
      await callback(records.slice(i, i + 100));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getBatchSize(operation: 'create' | 'update' | 'delete'): number {
    // For CSV, we can process all records at once since they're in memory
    return 1000;
  }

  async createRecords(
    tableSpec: CsvTableSpec,
    records: { wsId: string; fields: Record<string, unknown> }[],
    account: ConnectorAccount,
  ): Promise<{ wsId: string; remoteId: string }[]> {
    // Get the current CSV file
    const csvFile = await this.csvFileService.findOne(tableSpec.id.wsId, account.userId);
    if (!csvFile) {
      throw new Error(`CSV file not found: ${tableSpec.id.wsId}`);
    }

    // Parse existing CSV
    const csvData = parseCsv(csvFile.body);
    const existingRecords = csvData.records;
    const identityField = csvData.headers[0];

    // Add new records
    const newRecords = records.map((record) => {
      // Use the provided identity value or generate a unique one
      const identityValue =
        (record.fields[identityField] as string) || this.generateUniqueId(existingRecords, identityField);

      return {
        id: identityValue,
        fields: {
          ...record.fields,
          [identityField]: identityValue, // Ensure identity field is set
        } as Record<string, string>,
      };
    });

    // Combine existing and new records
    const allRecords = [...existingRecords, ...newRecords];

    // Convert back to CSV format
    const newCsvContent = this.convertToCsv(csvData.headers, allRecords);

    // Update the CSV file
    await this.csvFileService.update(
      tableSpec.id.wsId,
      {
        body: newCsvContent,
      },
      account.userId,
    );

    // Return the new record IDs
    return records.map((record, index) => ({
      wsId: record.wsId,
      remoteId: newRecords[index].id,
    }));
  }

  async updateRecords(
    tableSpec: CsvTableSpec,
    records: { id: { wsId: string; remoteId: string }; partialFields: Record<string, unknown> }[],
    account: ConnectorAccount,
  ): Promise<void> {
    // Get the current CSV file
    const csvFile = await this.csvFileService.findOne(tableSpec.id.wsId, account.userId);
    if (!csvFile) {
      throw new Error(`CSV file not found: ${tableSpec.id.wsId}`);
    }

    // Parse existing CSV
    const csvData = parseCsv(csvFile.body);
    const identityField = csvData.headers[0];

    // We don't care about the status of the CSV, this will just update all of them
    // Update records by finding them by identity field
    for (const record of records) {
      const recordToUpdate = csvData.records.find((r) => r.fields[identityField] === record.id.remoteId);
      if (recordToUpdate) {
        // Update the fields, but don't allow updating the identity field
        const { [identityField]: _, ...fieldsToUpdate } = record.partialFields as Record<string, string>;
        Object.assign(recordToUpdate.fields, fieldsToUpdate);
      }
    }

    // Convert back to CSV format
    const newCsvContent = this.convertToCsv(csvData.headers, csvData.records);

    // Update the CSV file
    await this.csvFileService.update(
      tableSpec.id.wsId,
      {
        body: newCsvContent,
      },
      account.userId,
    );
  }

  async deleteRecords(
    tableSpec: CsvTableSpec,
    recordIds: { wsId: string; remoteId: string }[],
    account: ConnectorAccount,
  ): Promise<void> {
    // Get the current CSV file
    const csvFile = await this.csvFileService.findOne(tableSpec.id.wsId, account.userId);
    if (!csvFile) {
      throw new Error(`CSV file not found: ${tableSpec.id.wsId}`);
    }

    // Parse existing CSV
    const csvData = parseCsv(csvFile.body);
    const identityField = csvData.headers[0];

    // Create a set of identity values to delete
    const identitiesToDelete = new Set(recordIds.map((record) => record.remoteId));

    // Filter out the records to delete
    const remainingRecords = csvData.records.filter((record) => !identitiesToDelete.has(record.fields[identityField]));

    // Convert back to CSV format
    const newCsvContent = this.convertToCsv(csvData.headers, remainingRecords);

    // Update the CSV file
    await this.csvFileService.update(
      tableSpec.id.wsId,
      {
        body: newCsvContent,
      },
      account.userId,
    );
  }

  private convertToCsv(headers: string[], records: { fields: Record<string, string> }[]): string {
    // Create header row
    const headerRow = headers.map((header) => this.escapeCsvField(header)).join(',');

    // Create data rows
    const dataRows = records.map((record) =>
      headers.map((header) => this.escapeCsvField(record.fields[header] || '')).join(','),
    );

    // Combine header and data rows
    return [headerRow, ...dataRows].join('\n');
  }

  private escapeCsvField(field: string): string {
    // If the field contains comma, quote, or newline, wrap it in quotes and escape internal quotes
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  private generateUniqueId(existingRecords: { fields: Record<string, string> }[], identityField: string): string {
    // Find the highest numeric ID and increment it
    const existingIds = existingRecords
      .map((record) => record.fields[identityField])
      .filter((id) => !isNaN(Number(id)))
      .map((id) => parseInt(id, 10));

    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    return (maxId + 1).toString();
  }
}
