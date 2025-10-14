/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { Service } from '@prisma/client';
import { parse, Parser } from 'csv-parse';
import matter from 'gray-matter';
import { from as copyFrom } from 'pg-copy-streams';
import { WSLogger } from 'src/logger';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { PostgresColumnType } from 'src/remote-service/connectors/types';
import { SnapshotDbService } from 'src/snapshot/snapshot-db.service';
import { SnapshotTableContext } from 'src/snapshot/types';
import { createCsvFileRecordId, createSnapshotId, createUploadId, SnapshotId } from 'src/types/ids';
import { Readable, Transform } from 'stream';
import { DbService } from '../db/db.service';
import { PreviewCsvResponseDto } from './dto/preview-csv.dto';
import { UploadCsvDto, UploadCsvResponseDto } from './dto/upload-csv.dto';
import { UploadMdResponseDto } from './dto/upload-md.dto';
import { MdUploadData, Upload, UploadType } from './types';
import { UploadsDbService } from './uploads-db.service';

@Injectable()
export class UploadsService {
  constructor(
    private readonly db: DbService,
    private readonly uploadsDbService: UploadsDbService,
    private readonly snapshotDbService: SnapshotDbService,
  ) {}
  async previewCsv(buffer: Buffer): Promise<PreviewCsvResponseDto> {
    return new Promise((resolve, reject) => {
      try {
        const stream = Readable.from(buffer.toString('utf-8'));
        const result: PreviewCsvResponseDto = {
          rows: [],
        };
        const maxLines = 10; // First 3 lines (headers + 2 data rows)

        const checkDone = () => {
          if (result.rows.length >= maxLines) {
            stream.destroy();
            parser.destroy();
            resolve(result);
            return true;
          } else {
            return false;
          }
        };

        const parser: Parser = parse({
          columns: false, // Don't use first row as headers yet
          skip_empty_lines: true,
          trim: true,
          to: maxLines,
          relax_column_count: true, // Allow inconsistent column counts
          skip_records_with_error: true, // Skip malformed records
          on_record: (record: string[]) => {
            result.rows.push({
              type: 'success',
              values: record,
            });
            checkDone();
            return record;
          },
          on_skip: (err: any) => {
            const errorMessage = (err?.message as string) || 'Unknown parsing error';
            const lineNumber = parser.info.lines;
            if (lineNumber > result.rows.length) {
              result.rows.push({
                type: 'error',
                error: [errorMessage],
              });
              checkDone();
            } else if (lineNumber === result.rows.length) {
              const row = result.rows[lineNumber - 1];
              if (!row || row.type !== 'error' || row.error.length === 0) {
                WSLogger.error({ message: 'Should not happen', source: 'uploads' });
              } else {
                row.error.push(errorMessage);
              }
            } else {
              WSLogger.error({ message: 'Should not happen', source: 'uploads' });
            }
          },
        });

        parser.on('end', () => {
          resolve(result);
        });
        parser.on('finish', () => {
          resolve(result);
        });

        // Pipe the stream to the parser
        stream.pipe(parser);
        console.log();
      } catch (error) {
        console.error('Error setting up CSV parsing:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reject(new Error(`Failed to setup CSV parsing: ${errorMessage}`));
      }
    });
  }

  /**
   * @deprecated - Use uploadCsv instead
   * Legacy method for snapshot CSV imports
   */
  async streamCsvToPostgres(
    buffer: Buffer,
    snapshotId: SnapshotId,
    tableId: string,
    columnNames: string[],
    firstRowIsHeader: boolean,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let recordCount = 0;
      let isFirstRow = true;

      // Create a Transform stream that listens to each record and passes it through
      const recordProcessor = new Transform({
        objectMode: true,
        transform(chunk: string[], encoding, callback) {
          try {
            // Skip header row if firstRowIsHeader is true
            if (firstRowIsHeader && isFirstRow) {
              isFirstRow = false;
              callback();
              return;
            }

            // Ensure we have the right number of columns
            const paddedRecord = [...chunk];
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

            recordCount++;

            // Pass the processed record through to the next stream
            callback(null, fullRecord);
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });

      // Create a Transform stream that converts records to CSV format
      const csvFormatter = new Transform({
        objectMode: true,
        transform(chunk: string[], encoding, callback) {
          try {
            // Convert to CSV format for COPY
            const csvRow = chunk
              .map((field) => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const escaped = String(field).replace(/"/g, '""');
                if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
                  return `"${escaped}"`;
                }
                return escaped;
              })
              .join(',');

            callback(null, csvRow + '\n');
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });

      // Set up the streaming pipeline
      const setupPipeline = async () => {
        try {
          // Get database connection
          const knexClient = this.snapshotDbService.snapshotDb.knex.client;
          const conn = await knexClient.acquireConnection();

          // Create the COPY stream
          const copyStream = conn.query(
            copyFrom(
              `COPY "${snapshotId}"."${tableId}" ("wsId", ${columnNames.map((name) => `"${name}"`).join(', ')}) 
              FROM STDIN 
              WITH (FORMAT CSV)`,
            ),
          );

          // Handle COPY stream events
          copyStream.on('error', (error: Error) => {
            console.error('COPY stream error:', error);
            reject(new Error(`Failed to copy data to PostgreSQL: ${error.message}`));
          });

          copyStream.on('finish', () => {
            console.log(`Successfully imported ${recordCount} rows to ${snapshotId}.${tableId}`);
            void knexClient.releaseConnection(conn);
            resolve();
          });

          // Create the CSV parser
          const parser = parse({
            columns: false,
            skip_empty_lines: true,
            trim: true,
          });

          // Handle parser events
          parser.on('error', (error: Error) => {
            console.error('CSV parser error:', error);
            reject(new Error(`Failed to parse CSV: ${error.message}`));
          });

          // Set up the complete pipeline
          const csvStream = Readable.from(buffer.toString('utf-8'));

          csvStream.pipe(parser).pipe(recordProcessor).pipe(csvFormatter).pipe(copyStream);
        } catch (error) {
          console.error('Error setting up streaming pipeline:', error);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };

      // Start the pipeline
      void setupPipeline();
    });
  }

  /**
   * Upload a CSV file, creating a new Upload entity and streaming data to a PG table
   */
  async uploadCsv(
    buffer: Buffer,
    userId: string,
    dto: UploadCsvDto,
  ): Promise<UploadCsvResponseDto & { upload: Upload }> {
    const uploadId = createUploadId();

    // Create table ID: csv_timestamp_name
    const timestamp = Date.now();
    const sanitizedName = dto.uploadName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .substring(0, 50); // Limit length
    const tableId = `csv_${timestamp}_${sanitizedName}`;

    try {
      // Ensure user's upload schema exists
      await this.uploadsDbService.ensureUserUploadSchema(userId);

      // Create the CSV table
      await this.uploadsDbService.createCsvTable(
        userId,
        tableId,
        dto.columnNames.map((name, index) => ({
          name,
          pgType: dto.columnTypes[index],
        })),
      );

      // Stream CSV data to the table
      let rowCount = 0;
      await this.streamCsvToUploadsTable(buffer, userId, tableId, dto.columnNames, dto.firstRowIsHeader, (count) => {
        rowCount = count;
      });

      // Create Upload record in public schema
      const upload = await this.db.client.upload.create({
        data: {
          id: uploadId,
          userId,
          name: dto.uploadName,
          type: UploadType.CSV,
          typeId: tableId,
        },
      });

      console.log(`Successfully created CSV upload ${uploadId} with ${rowCount} rows`);

      return {
        uploadId,
        tableId,
        rowCount,
        upload: upload as Upload,
      };
    } catch (error) {
      // Clean up on error
      console.error('Error uploading CSV:', error);

      // Try to clean up the table if it was created
      try {
        await this.uploadsDbService.dropCsvTable(userId, tableId);
      } catch (cleanupError) {
        console.error('Error cleaning up CSV table:', cleanupError);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload CSV: ${errorMessage}`);
    }
  }

  /**
   * Stream CSV data to a table in the user's upload schema
   */
  private async streamCsvToUploadsTable(
    buffer: Buffer,
    userId: string,
    tableId: string,
    columnNames: string[],
    firstRowIsHeader: boolean,
    onComplete?: (recordCount: number) => void,
  ): Promise<void> {
    const schemaName = this.uploadsDbService.getUserUploadSchema(userId);

    return new Promise((resolve, reject) => {
      let recordCount = 0;
      let isFirstRow = true;

      // Create a Transform stream that listens to each record and passes it through
      const recordProcessor = new Transform({
        objectMode: true,
        transform(chunk: string[], encoding, callback) {
          try {
            // Skip header row if firstRowIsHeader is true
            if (firstRowIsHeader && isFirstRow) {
              isFirstRow = false;
              callback();
              return;
            }

            // Ensure we have the right number of columns
            const paddedRecord = [...chunk];
            while (paddedRecord.length < columnNames.length) {
              paddedRecord.push('');
            }
            if (paddedRecord.length > columnNames.length) {
              paddedRecord.splice(columnNames.length);
            }

            // Generate a unique remoteId for this record (CSV upload table represents the remote source)
            const remoteId = createCsvFileRecordId();

            // Create the full record with remoteId as first column, then the data columns
            const fullRecord = [remoteId, ...paddedRecord];

            recordCount++;

            // Pass the processed record through to the next stream
            callback(null, fullRecord);
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });

      // Create a Transform stream that converts records to CSV format
      const csvFormatter = new Transform({
        objectMode: true,
        transform(chunk: string[], encoding, callback) {
          try {
            // Convert to CSV format for COPY
            const csvRow = chunk
              .map((field) => {
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                const escaped = String(field).replace(/"/g, '""');
                if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
                  return `"${escaped}"`;
                }
                return escaped;
              })
              .join(',');

            callback(null, csvRow + '\n');
          } catch (error) {
            callback(error instanceof Error ? error : new Error(String(error)));
          }
        },
      });

      // Set up the streaming pipeline
      const setupPipeline = async () => {
        try {
          // Get database connection
          const knexClient = this.uploadsDbService.knex.client;
          const conn = await knexClient.acquireConnection();

          // Create the COPY stream
          const copyStream = conn.query(
            copyFrom(
              `COPY "${schemaName}"."${tableId}" ("remoteId", ${columnNames.map((name) => `"${name}"`).join(', ')}) 
              FROM STDIN 
              WITH (FORMAT CSV)`,
            ),
          );

          // Handle COPY stream events
          copyStream.on('error', (error: Error) => {
            console.error('COPY stream error:', error);
            reject(new Error(`Failed to copy data to PostgreSQL: ${error.message}`));
          });

          copyStream.on('finish', () => {
            console.log(`Successfully imported ${recordCount} rows to ${schemaName}.${tableId}`);
            if (onComplete) {
              onComplete(recordCount);
            }
            void knexClient.releaseConnection(conn);
            resolve();
          });

          // Create the CSV parser
          const parser = parse({
            columns: false,
            skip_empty_lines: true,
            trim: true,
          });

          // Handle parser events
          parser.on('error', (error: Error) => {
            console.error('CSV parser error:', error);
            reject(new Error(`Failed to parse CSV: ${error.message}`));
          });

          // Set up the complete pipeline
          const csvStream = Readable.from(buffer.toString('utf-8'));

          csvStream.pipe(parser).pipe(recordProcessor).pipe(csvFormatter).pipe(copyStream);
        } catch (error) {
          console.error('Error setting up streaming pipeline:', error);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };

      // Start the pipeline
      void setupPipeline();
    });
  }

  /**
   * List all uploads for a user
   */
  async listUploads(userId: string): Promise<Upload[]> {
    const uploads = await this.db.client.upload.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return uploads as Upload[];
  }

  /**
   * Get a single upload by ID
   */
  async getUpload(uploadId: string, userId: string): Promise<Upload> {
    const upload = await this.db.client.upload.findFirst({
      where: { id: uploadId, userId },
    });

    if (!upload) {
      throw new Error('Upload not found');
    }

    return upload as Upload;
  }

  /**
   * Delete an upload (and its associated data)
   */
  async deleteUpload(uploadId: string, userId: string): Promise<void> {
    const upload = await this.getUpload(uploadId, userId);

    // Delete based on type
    if (upload.type === 'CSV') {
      // Drop the CSV table
      await this.uploadsDbService.dropCsvTable(userId, upload.typeId);
    } else if (upload.type === 'MD') {
      // Delete from MdUploads table
      await this.deleteMdUpload(userId, upload.typeId);
    }

    // Delete the Upload record
    await this.db.client.upload.delete({
      where: { id: uploadId },
    });

    console.log(`Deleted upload ${uploadId}`);
  }

  /**
   * Get CSV data for a specific upload
   */
  async getCsvData(uploadId: string, userId: string, limit = 100, offset = 0): Promise<{ rows: any[]; total: number }> {
    const upload = await this.getUpload(uploadId, userId);

    if (upload.type !== 'CSV') {
      throw new Error('Upload is not a CSV');
    }

    const schemaName = this.uploadsDbService.getUserUploadSchema(userId);
    const tableId = upload.typeId;

    // Get total count
    const countResult = await this.uploadsDbService.knex(tableId).withSchema(schemaName).count('* as count');
    const total = Number(countResult[0].count);

    // Get rows
    const rows = await this.uploadsDbService.knex(tableId).withSchema(schemaName).limit(limit).offset(offset);

    return { rows, total };
  }

  /**
   * Helper method to delete MD upload data
   */
  private async deleteMdUpload(userId: string, mdUploadId: string): Promise<void> {
    const schemaName = this.uploadsDbService.getUserUploadSchema(userId);

    await this.uploadsDbService.knex('MdUploads').withSchema(schemaName).where({ id: mdUploadId }).delete();

    console.log(`Deleted MD upload ${mdUploadId} from ${schemaName}`);
  }

  /**
   * Helper function to infer the type of a value
   */
  private inferType(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  /**
   * Preview a Markdown file with front matter
   */
  previewMarkdown(
    buffer: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    userId: string,
  ): Promise<{ data: Record<string, { value: unknown; type: string }>; PAGE_CONTENT: string }> {
    try {
      // Parse the markdown file
      const fileContent = buffer.toString('utf-8');
      const parsed = matter(fileContent);

      // console.debug('MD Preview for user:', userId);
      // console.debug('Front matter keys:', Object.keys(parsed.data));
      // console.debug('Content length:', parsed.content.length);

      // Transform data to include type information
      const dataWithTypes: Record<string, { value: unknown; type: string }> = {};
      for (const [key, value] of Object.entries(parsed.data)) {
        dataWithTypes[key] = {
          value,
          type: this.inferType(value),
        };
      }

      return Promise.resolve({
        data: dataWithTypes,
        PAGE_CONTENT: parsed.content,
      });
    } catch (error) {
      console.error('Error previewing markdown:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Promise.reject(new Error(`Failed to preview markdown: ${errorMessage}`));
    }
  }

  /**
   * Upload a Markdown file with front matter
   */
  async uploadMarkdown(
    buffer: Buffer,
    userId: string,
    fileName: string,
  ): Promise<UploadMdResponseDto & { upload: Upload }> {
    const uploadId = createUploadId();
    const mdUploadId = `md_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Parse the markdown file
      const fileContent = buffer.toString('utf-8');
      const parsed = matter(fileContent);

      // Ensure user's upload schema and MdUploads table exist
      await this.uploadsDbService.ensureMdUploadsTable(userId);

      const schemaName = this.uploadsDbService.getUserUploadSchema(userId);

      // Insert into MdUploads table
      await this.uploadsDbService
        .knex('MdUploads')
        .withSchema(schemaName)
        .insert({
          id: mdUploadId,
          PAGE_CONTENT: parsed.content,
          data: JSON.stringify(parsed.data),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      // Create Upload record in public schema
      const upload = await this.db.client.upload.create({
        data: {
          id: uploadId,
          userId,
          name: fileName,
          type: UploadType.MD,
          typeId: mdUploadId,
        },
      });

      const frontMatterKeys = Object.keys(parsed.data);
      console.log(`Successfully created MD upload ${uploadId} with front matter keys: ${frontMatterKeys.join(', ')}`);

      return {
        uploadId,
        mdUploadId,
        frontMatterKeys,
        upload: upload as Upload,
      };
    } catch (error) {
      // Clean up on error
      console.error('Error uploading markdown:', error);

      // Try to clean up the MD record if it was created
      try {
        await this.deleteMdUpload(userId, mdUploadId);
      } catch (cleanupError) {
        console.error('Error cleaning up MD upload:', cleanupError);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to upload markdown: ${errorMessage}`);
    }
  }

  /**
   * Get markdown data for a specific upload
   */
  async getMdData(uploadId: string, userId: string): Promise<MdUploadData> {
    const upload = await this.getUpload(uploadId, userId);

    if (upload.type !== 'MD') {
      throw new Error('Upload is not a Markdown file');
    }

    const schemaName = this.uploadsDbService.getUserUploadSchema(userId);
    const mdUploadId = upload.typeId;

    const result = await this.uploadsDbService
      .knex('MdUploads')
      .withSchema(schemaName)
      .where({ id: mdUploadId })
      .first();

    if (!result) {
      throw new Error('Markdown upload data not found');
    }

    return {
      id: result.id as string,
      PAGE_CONTENT: result.PAGE_CONTENT,
      data: typeof result.data === 'string' ? (JSON.parse(result.data) as Record<string, unknown>) : result.data,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    } as MdUploadData;
  }

  /**
   * Create a snapshot (scratchpaper) from a CSV upload
   */
  async createSnapshotFromCsvUpload(
    uploadId: string,
    userId: string,
    snapshotName: string,
  ): Promise<{ snapshotId: string; tableId: string }> {
    // Get the upload
    const upload = await this.getUpload(uploadId, userId);

    if (upload.type !== 'CSV') {
      throw new Error('Upload is not a CSV file');
    }

    const snapshotId = createSnapshotId();
    const tableId = uploadId; // Use uploadId as tableId so we can track it back to the upload
    const uploadSchemaName = this.uploadsDbService.getUserUploadSchema(userId);
    const uploadTableName = upload.typeId;

    try {
      // Get table structure from upload table
      const tableInfo = await this.uploadsDbService.knex(uploadTableName).withSchema(uploadSchemaName).columnInfo();

      // Convert table structure to table spec (exclude remoteId and timestamps - those are metadata)
      const columnNames = Object.keys(tableInfo).filter(
        (col) => col !== 'remoteId' && col !== 'createdAt' && col !== 'updatedAt',
      );

      const columns = columnNames.map((name) => {
        const colInfo = tableInfo[name];
        // Map Postgres types to our PostgresColumnType enum
        let pgType = PostgresColumnType.TEXT;
        if (
          colInfo.type === 'integer' ||
          colInfo.type === 'bigint' ||
          colInfo.type === 'numeric' ||
          colInfo.type === 'decimal' ||
          colInfo.type === 'double precision'
        ) {
          pgType = PostgresColumnType.NUMERIC;
        } else if (colInfo.type === 'boolean') {
          pgType = PostgresColumnType.BOOLEAN;
        }

        return {
          id: { wsId: name, remoteId: [name] },
          name: name,
          pgType,
          readonly: false,
        };
      });

      const tableSpecs = [
        {
          id: { wsId: tableId, remoteId: [uploadId] }, // Store uploadId in remoteId so we can find it
          name: snapshotName,
          columns,
        },
      ] satisfies AnyTableSpec[];

      // Create the snapshot in the database
      await this.db.client.snapshot.create({
        data: {
          id: snapshotId,
          userId,
          connectorAccountId: null, // No connector account needed for CSV
          name: snapshotName,
          service: Service.CSV, // Set service to CSV
          tableSpecs,
          tableContexts: [
            {
              id: { wsId: tableId, remoteId: [uploadId] },
              activeViewId: null,
              ignoredColumns: [],
              readOnlyColumns: [],
            },
          ] satisfies SnapshotTableContext[],
        },
      });

      // Create the snapshot schema and table
      await this.snapshotDbService.snapshotDb.createForSnapshot(snapshotId, tableSpecs);

      // Copy data from upload table to snapshot table
      // Generate csr_ prefixed IDs (CSV Snapshot Record) for wsId column
      // Copy remoteId from upload table to id column in snapshot
      const copyQuery = `
        INSERT INTO "${snapshotId}"."${tableId}" ("wsId", "id", ${columnNames.map((c) => `"${c}"`).join(', ')})
        SELECT 
          'csr_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) as "wsId",
          "remoteId" as "id",
          ${columnNames.map((c) => `"${c}"`).join(', ')}
        FROM "${uploadSchemaName}"."${uploadTableName}"
      `;

      await this.uploadsDbService.knex.raw(copyQuery);

      console.log(`Successfully created snapshot ${snapshotId} from CSV upload ${uploadId}`);

      return { snapshotId, tableId };
    } catch (error) {
      // Clean up snapshot if creation failed
      try {
        await this.snapshotDbService.snapshotDb.cleanUpSnapshot(snapshotId);
        await this.db.client.snapshot.delete({ where: { id: snapshotId } });
      } catch (cleanupError) {
        console.error('Error cleaning up failed snapshot:', cleanupError);
      }

      console.error('Error creating snapshot from CSV upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create snapshot from CSV upload: ${errorMessage}`);
    }
  }
}
