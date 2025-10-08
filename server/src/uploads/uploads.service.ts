/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { parse, Parser } from 'csv-parse';
import { from as copyFrom } from 'pg-copy-streams';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { PostgresColumnType } from 'src/remote-service/connectors/types';
import { SnapshotDbService } from 'src/snapshot/snapshot-db.service';
import { SnapshotService } from 'src/snapshot/snapshot.service';
import { createSnapshotId, SnapshotId } from 'src/types/ids';
import { Readable } from 'stream';
import { DbService } from '../db/db.service';

@Injectable()
export class UploadsService {
  constructor(
    private readonly snapshotService: SnapshotService,
    private readonly snapshotDbService: SnapshotDbService,
    private readonly db: DbService,
  ) {}
  async previewCsv(buffer: Buffer, userId: string): Promise<{ rows: string[][] }> {
    return new Promise((resolve, reject) => {
      try {
        const stream = Readable.from(buffer.toString('utf-8'));
        const records: string[][] = [];
        let lineCount = 0;
        const maxLines = 6; // First 3 lines (headers + 2 data rows)

        const parser: Parser = parse({
          columns: false, // Don't use first row as headers yet
          skip_empty_lines: true,
          trim: true,
        });

        parser.on('readable', () => {
          let record: string[] | null;
          while ((record = parser.read() as string[] | null) !== null && lineCount < maxLines) {
            records.push(record);
            lineCount++;

            // Terminate parsing once we have enough lines
            if (lineCount >= maxLines) {
              // Stop the stream and resolve immediately
              stream.destroy();
              parser.destroy();

              // Process the results
              if (records.length === 0) {
                reject(new Error('CSV file is empty'));
                return;
              }

              // Log the data as requested
              console.debug('CSV Preview for user:', userId);
              console.debug('Rows:', records);

              resolve({
                rows: records,
              });
              return;
            }
          }
        });

        parser.on('error', (error: Error) => {
          console.error('Error parsing CSV:', error);
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        });

        parser.on('end', () => {
          if (records.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }

          // Log the data as requested
          console.debug('CSV Preview for user:', userId);
          console.debug('Rows:', records);

          resolve({
            rows: records,
          });
        });

        // Pipe the stream to the parser
        stream.pipe(parser);
      } catch (error) {
        console.error('Error setting up CSV parsing:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error(`Failed to setup CSV parsing: ${errorMessage}`));
      }
    });
  }

  async importCsv(
    buffer: Buffer,
    userId: string,
    scratchpaperName: string,
    columnNames: string[],
    columnTypes: PostgresColumnType[],
    firstRowIsHeader: boolean,
  ): Promise<{ snapshotId: string; tableId: string }> {
    try {
      // Create a connectorless snapshot
      const snapshotId = createSnapshotId();
      const tableId = 'csv_data'; // Single table for CSV imports

      // Create table specs from user configuration
      const tableSpecs = [
        {
          id: { wsId: tableId, remoteId: ['-'] },
          name: scratchpaperName,
          columns: columnNames.map((name, index) => ({
            id: { wsId: name, remoteId: ['-'] },
            name: name,
            pgType: columnTypes[index] || PostgresColumnType.TEXT,
            readonly: false,
          })),
        },
      ] satisfies AnyTableSpec[];

      // Create the snapshot in the database
      await this.db.client.snapshot.create({
        data: {
          id: snapshotId,
          userId, // Direct user association
          connectorAccountId: null, // Connectorless snapshot
          name: scratchpaperName,
          tableSpecs,
          tableContexts: [
            {
              id: { wsId: tableId, remoteId: '-' },
              activeViewId: null,
              ignoredColumns: [],
              readOnlyColumns: [],
            },
          ],
        },
      });

      // Create the database schema and table
      await this.snapshotDbService.snapshotDb.createForSnapshot(snapshotId, tableSpecs);

      // Stream CSV data to PostgreSQL using COPY
      await this.streamCsvToPostgres(buffer, snapshotId, tableId, columnNames, firstRowIsHeader);

      return { snapshotId, tableId };
    } catch (error) {
      console.error('Error importing CSV:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to import CSV: ${errorMessage}`);
    }
  }

  private async streamCsvToPostgres(
    buffer: Buffer,
    snapshotId: SnapshotId,
    tableId: string,
    columnNames: string[],
    firstRowIsHeader: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create a readable stream from the CSV buffer
        const csvStream = Readable.from(buffer.toString('utf-8'));

        // Parse CSV and create a stream for PostgreSQL COPY
        const parser = parse({
          columns: false, // We'll handle headers manually
          skip_empty_lines: true,
          trim: true,
        });

        let isFirstRow = true;
        const processedRows: string[] = [];

        parser.on('readable', () => {
          let record: string[] | null;
          while ((record = parser.read() as string[] | null) !== null) {
            // Skip header row if firstRowIsHeader is true
            if (firstRowIsHeader && isFirstRow) {
              isFirstRow = false;
              continue;
            }

            // Ensure we have the right number of columns
            const paddedRecord = [...record];
            while (paddedRecord.length < columnNames.length) {
              paddedRecord.push('');
            }
            if (paddedRecord.length > columnNames.length) {
              paddedRecord.splice(columnNames.length);
            }

            // Generate a unique wsId for this record
            const wsId = `csv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Create the full record with wsId as first column, then the data columns
            const fullRecord = [wsId, ...paddedRecord];

            // Convert to CSV format for COPY
            const csvRow = fullRecord
              .map((field) => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const escaped = String(field).replace(/"/g, '""');
                if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
                  return `"${escaped}"`;
                }
                return escaped;
              })
              .join(',');

            processedRows.push(csvRow);
          }
        });

        parser.on('end', () => {
          const fn = async () => {
            try {
              // Get database connection
              const knexClient = this.snapshotDbService.snapshotDb.knex.client;
              const conn = await knexClient.acquireConnection();

              try {
                // Create the COPY stream - include wsId as first column, then the data columns
                const copyStream = conn.query(
                  copyFrom(
                    `COPY "${snapshotId}"."${tableId}" ("wsId", ${columnNames.map((name) => `"${name}"`).join(', ')}) FROM STDIN WITH (FORMAT CSV)`,
                  ),
                );

                // Create a readable stream from processed rows
                const dataStream = Readable.from(processedRows.join('\n') + '\n');

                // Handle stream events
                copyStream.on('error', (error: Error) => {
                  console.error('COPY stream error:', error);
                  reject(new Error(`Failed to copy data to PostgreSQL: ${error.message}`));
                });

                copyStream.on('finish', () => {
                  console.log(`Successfully imported ${processedRows.length} rows to ${snapshotId}.${tableId}`);
                  resolve();
                });

                // Pipe data to COPY stream
                dataStream.pipe(copyStream);

                // Release connection when done
                copyStream.on('finish', () => {
                  void knexClient.releaseConnection(conn);
                });
              } catch (error) {
                await knexClient.releaseConnection(conn);
                throw error;
              }
            } catch (error) {
              console.error('Error setting up COPY stream:', error);
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          };
          void fn();
        });

        parser.on('error', (error: Error) => {
          console.error('CSV parser error:', error);
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        });

        // Start parsing
        csvStream.pipe(parser);
      } catch (error) {
        console.error('Error setting up CSV streaming:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async createTemplate(userId: string, scratchpaperName: string): Promise<{ snapshotId: string; tableId: string }> {
    try {
      // Create a connectorless snapshot
      const snapshotId = createSnapshotId();
      const tableId = 'content_data'; // Single table for template imports

      // Sample data for the template (same as the original CONTENT_FILE_BODY)
      const sampleData = [
        { id: '1', name: 'Sample Item', content_md: 'This is some test content', status: 'unpublished' },
      ];

      // Create table specs for the template
      const tableSpecs = [
        {
          id: { wsId: tableId, remoteId: ['-'] },
          name: scratchpaperName,
          columns: [
            {
              id: { wsId: 'id', remoteId: ['-'] },
              name: 'id',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
            {
              id: { wsId: 'name', remoteId: ['-'] },
              name: 'name',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
            {
              id: { wsId: 'content_md', remoteId: ['-'] },
              name: 'content_md',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
            {
              id: { wsId: 'status', remoteId: ['-'] },
              name: 'status',
              pgType: PostgresColumnType.TEXT,
              readonly: false,
            },
          ],
        },
      ] satisfies AnyTableSpec[];

      // Create the snapshot in the database
      await this.db.client.snapshot.create({
        data: {
          id: snapshotId,
          userId, // Direct user association
          connectorAccountId: null, // Connectorless snapshot
          name: scratchpaperName,
          tableSpecs,
          tableContexts: [
            {
              id: { wsId: tableId, remoteId: '-' },
              activeViewId: null,
              ignoredColumns: [],
              readOnlyColumns: [],
            },
          ],
        },
      });

      // Create the database schema and table
      await this.snapshotDbService.snapshotDb.createForSnapshot(snapshotId, tableSpecs);

      // Insert sample data using regular Knex (no streaming needed for small data)
      await this.insertTemplateData(snapshotId, tableId, sampleData);

      return { snapshotId, tableId };
    } catch (error) {
      console.error('Error creating template:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create template: ${errorMessage}`);
    }
  }

  private async insertTemplateData(snapshotId: SnapshotId, tableId: string, sampleData: any[]): Promise<void> {
    try {
      const knex = this.snapshotDbService.snapshotDb.knex;

      // Insert each record with a generated wsId
      for (const record of sampleData) {
        const wsId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await knex(`${snapshotId}.${tableId}`).insert({
          wsId,
          ...record,
          __edited_fields: {},
          __suggested_values: {},
          __metadata: {},
          __dirty: false,
        });
      }

      console.log(`Successfully inserted ${sampleData.length} template records to ${snapshotId}.${tableId}`);
    } catch (error) {
      console.error('Error inserting template data:', error);
      throw new Error(`Failed to insert template data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
