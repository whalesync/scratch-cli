/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Service } from '@prisma/client';
import { parse, Parser } from 'csv-parse';
import type { Response } from 'express';
import matter from 'gray-matter';
import { WSLogger } from 'src/logger';
import { sanitizeForTableWsId } from 'src/remote-service/connectors/ids';
import { CsvSchemaParser } from 'src/remote-service/connectors/library/csv/csv-schema-parser';
import { AnyTableSpec, CsvColumnSpec } from 'src/remote-service/connectors/library/custom-spec-registry';
import { createSnapshotTableId, createUploadId, createWorkbookId, SnapshotTableId, WorkbookId } from 'src/types/ids';
import { Actor } from 'src/users/types';
import { createCsvStream } from 'src/utils/csv-stream.helper';
import { pipeline, Readable } from 'stream';
import { DbService } from '../db/db.service';
import { SnapshotDbService } from '../workbook/snapshot-db.service';
import { FormatterTransform } from './csvStreams/FormatterTransform';
import { ParserTransform } from './csvStreams/ParserTransform';
import { PgCopyFromWritableStream } from './csvStreams/PgCopyFromWritableStream';
import { ProcessorTransform } from './csvStreams/ProcessorTransform';
import { PreviewCsvResponseDto } from './dto/preview-csv.dto';
import { CsvAdvancedSettings, UploadCsvDto, UploadCsvResponseDto } from './dto/upload-csv.dto';
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
   * Upload a CSV file, creating a new Upload entity and streaming data to a PG table
   */
  async uploadCsv(buffer: Buffer, actor: Actor, dto: UploadCsvDto): Promise<UploadCsvResponseDto & { upload: Upload }> {
    const uploadId = createUploadId();

    // Validate column names - reject empty or whitespace-only names
    const invalidColumns = dto.columnNames
      .map((name, index) => ({ name, index }))
      .filter(({ name }) => !name || name.trim().length === 0);

    if (invalidColumns.length > 0) {
      throw new BadRequestException(
        `Invalid column names detected at positions: ${invalidColumns.map((c) => c.index + 1).join(', ')}. Column names cannot be empty.`,
      );
    }

    // Validate column names - reject forbidden names
    const forbiddenNames = ['wsId', 'remoteId'];
    const forbiddenColumns = dto.columnNames
      .map((name, index) => ({ name, index }))
      .filter(({ name }) => forbiddenNames.includes(name));

    if (forbiddenColumns.length > 0) {
      throw new BadRequestException(
        `Forbidden column names: ${forbiddenColumns.map((c) => c.name + ' (position: ' + (c.index + 1) + ')').join(', ')}`,
      );
    }

    // Create table ID: csv_timestamp_name
    const timestamp = Date.now();
    const sanitizedName = dto.uploadName
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .substring(0, 50); // Limit length
    const tableId = `csv_${timestamp}_${sanitizedName}`;

    const schemaName = this.uploadsDbService.getUploadSchemaName(actor);
    const qualifiedTableName = `"${schemaName}"."${tableId}"`;

    try {
      // Ensure user's upload schema exists
      await this.uploadsDbService.ensureUserUploadSchema(actor);

      // Create the CSV table
      await this.uploadsDbService.createCsvTable(
        actor,
        tableId,
        dto.columnNames.map((name, index) => ({
          name,
          pgType: dto.columnTypes[index],
        })),
      );

      // Stream CSV data to the table

      const rowCount = await this.streamCsvToTable(
        buffer,
        qualifiedTableName,
        dto.columnNames,
        dto.columnIndices,
        dto.firstRowIsHeader,
        dto.advancedSettings,
      );

      // Create Upload record in public schema
      const upload = await this.db.client.upload.create({
        data: {
          id: uploadId,
          userId: actor.userId,
          organizationId: actor.organizationId,
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
        await this.uploadsDbService.dropCsvTable(actor, tableId);
      } catch (cleanupError) {
        console.error('Error cleaning up CSV table:', cleanupError);
      }

      throw error;
    }
  }

  /**
   * Stream CSV data to a table in the user's upload schema
   */
  private async streamCsvToTable(
    buffer: Buffer,
    qualifiedTableName: string,
    columnNames: string[],
    columnIndices: number[],
    firstRowIsHeader: boolean,
    advancedSettings: CsvAdvancedSettings,
  ): Promise<number> {
    const fileReadable = Readable.from(buffer.toString('utf-8'));
    const parserTransform = new ParserTransform(advancedSettings);
    const processorTransform = new ProcessorTransform(firstRowIsHeader, columnIndices);
    const formatterTransform = new FormatterTransform();

    const pgCopyWritable = new PgCopyFromWritableStream(
      qualifiedTableName,
      columnNames,
      this.uploadsDbService.knex.client,
    );

    await pgCopyWritable.connect();

    // Use Node.js pipeline utility for proper error propagation
    return new Promise((resolve, reject) => {
      pipeline(fileReadable, parserTransform, processorTransform, formatterTransform, pgCopyWritable, (error) => {
        // Always cleanup, regardless of success or failure
        pgCopyWritable
          .kill()
          .then(() => {
            if (error) {
              WSLogger.error({ message: `Pipeline error: ${error.message}`, source: 'uploads' });
              const wrappedError = new InternalServerErrorException(error.message);
              reject(wrappedError);
            } else {
              WSLogger.info({
                message: `Pipeline completed successfully, record count: ${processorTransform.getRecordCount()}`,
                source: 'uploads',
              });
              resolve(processorTransform.getRecordCount());
            }
          })
          .catch((disconnectError) => {
            WSLogger.error({
              message: `Error during disconnect: ${disconnectError.message}`,
              source: 'uploads',
            });
            // If there was already an error, report that one; otherwise report disconnect error
            if (error) {
              reject(new InternalServerErrorException(error.message));
            } else {
              reject(new InternalServerErrorException(`Disconnect failed: ${disconnectError.message}`));
            }
          });
      });
    });
  }

  /**
   * List all uploads for a user
   */
  async listUploads(actor: Actor): Promise<Upload[]> {
    const uploads = await this.db.client.upload.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return uploads as Upload[];
  }

  /**
   * Get a single upload by ID
   */
  async getUpload(uploadId: string, actor: Actor): Promise<Upload> {
    const upload = await this.db.client.upload.findFirst({
      where: { id: uploadId, organizationId: actor.organizationId },
    });

    if (!upload) {
      throw new Error('Upload not found');
    }

    return upload as Upload;
  }

  /**
   * Delete an upload (and its associated data)
   */
  async deleteUpload(uploadId: string, actor: Actor): Promise<void> {
    const upload = await this.getUpload(uploadId, actor);

    // Delete based on type
    if (upload.type === 'CSV') {
      // Drop the CSV table
      await this.uploadsDbService.dropCsvTable(actor, upload.typeId);
    } else if (upload.type === 'MD') {
      // Delete from MdUploads table
      await this.deleteMdUpload(actor, upload.typeId);
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
  async getCsvData(uploadId: string, actor: Actor, limit = 10, offset = 0): Promise<{ rows: any[]; total: number }> {
    const upload = await this.getUpload(uploadId, actor);

    if (upload.type !== 'CSV') {
      throw new Error('Upload is not a CSV');
    }

    const schemaName = this.uploadsDbService.getUploadSchemaName(actor);
    const tableId = upload.typeId;

    // Get total count
    const countResult = await this.uploadsDbService.knex(tableId).withSchema(schemaName).count('* as count');
    const total = Number(countResult[0].count);

    // Get rows
    const rows = await this.uploadsDbService.knex(tableId).withSchema(schemaName).limit(limit).offset(offset);

    return { rows, total };
  }

  /**
   * Gets a preview of the columns in a CSV upload as they would look when used in a SnapshotTable
   * @param uploadId The ID of the upload
   * @param actor The actor making the request
   * @returns The structure of the column in the upload table as it would look in a SnapshotTable
   */
  async getCsvColumnsForUpload(uploadId: string, actor: Actor): Promise<CsvColumnSpec[]> {
    const upload = await this.getUpload(uploadId, actor);

    if (upload.type !== 'CSV') {
      throw new Error('Upload is not a CSV');
    }

    const schemaName = this.uploadsDbService.getUploadSchemaName(actor);
    const tableId = upload.typeId;

    const columnInfo = await this.uploadsDbService.knex(tableId).withSchema(schemaName).columnInfo();

    const schemaParser = new CsvSchemaParser();
    // Convert table structure to table spec (exclude remoteId and timestamps - those are metadata)
    const columnNames = Object.keys(columnInfo).filter(
      (col) => col !== 'remoteId' && col !== 'createdAt' && col !== 'updatedAt',
    );

    const columns = columnNames.map((name) => {
      const colInfo = columnInfo[name];
      // Map Postgres types to our PostgresColumnType enum
      const pgType = schemaParser.getPostgresType(colInfo);
      const metadata = schemaParser.getColumnMetadata(name, colInfo);

      return {
        id: { wsId: name, remoteId: [name] },
        name: name,
        pgType,
        metadata,
        readonly: false,
      };
    });

    return columns;
  }

  /**
   * Download a CSV upload as a CSV file (authenticated)
   */
  async downloadCsv(uploadId: string, actor: Actor, res: Response): Promise<void> {
    // Verify user has access to the upload
    const upload = await this.getUpload(uploadId, actor);

    if (upload.type !== 'CSV') {
      throw new NotFoundException('Upload is not a CSV');
    }

    await this.streamCsvDownload(upload, res);
  }

  /**
   * Download a CSV upload as a CSV file (public - no auth required)
   * Security relies on upload IDs being unguessable
   */
  async downloadCsvPublic(uploadId: string, res: Response): Promise<void> {
    const upload = await this.db.client.upload.findUnique({
      where: { id: uploadId },
    });

    if (!upload) {
      throw new NotFoundException('Upload not found');
    }

    if (upload.type !== 'CSV') {
      throw new NotFoundException('Upload is not a CSV');
    }

    await this.streamCsvDownload(upload as Upload, res);
  }

  /**
   * Helper method to stream CSV download
   */
  private async streamCsvDownload(upload: Upload, res: Response): Promise<void> {
    try {
      const schemaName = this.uploadsDbService.getUploadSchemaName({
        userId: upload.userId,
        organizationId: upload.organizationId,
      });
      const tableId = upload.typeId;

      // Get column names from the table, excluding metadata columns
      const columnQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = '${schemaName}' 
        AND table_name = '${tableId}'
        AND column_name NOT IN ('remoteId', 'createdAt', 'updatedAt')
        ORDER BY ordinal_position
      `;

      interface ColumnInfo {
        rows: {
          column_name: string;
        }[];
      }
      const columns = await this.uploadsDbService.knex.raw<ColumnInfo>(columnQuery);
      const columnNames = columns.rows.map((row) => row.column_name);

      // Set response headers
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const filename = upload.name;
      // Use RFC 5987 encoding for better browser compatibility
      // Include both filename (for old browsers) and filename* (RFC 5987 for modern browsers)
      const encodedFilename = encodeURIComponent(filename);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`);

      // Use the CSV stream helper to stream the data
      const { stream, cleanup } = await createCsvStream({
        knex: this.uploadsDbService.knex,
        schema: schemaName,
        table: tableId,
        columnNames,
      });

      stream.on('error', (e: Error) => {
        res.destroy(e);
      });

      stream.pipe(res).on('finish', () => {
        void cleanup();
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to generate CSV: ${errorMessage}`);
    }
  }

  /**
   * Helper method to delete MD upload data
   */
  private async deleteMdUpload(actor: Actor, mdUploadId: string): Promise<void> {
    const schemaName = this.uploadsDbService.getUploadSchemaName(actor);

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
    actor: Actor,
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
    actor: Actor,
    fileName: string,
  ): Promise<UploadMdResponseDto & { upload: Upload }> {
    const uploadId = createUploadId();
    const mdUploadId = `md_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Parse the markdown file
      const fileContent = buffer.toString('utf-8');
      const parsed = matter(fileContent);

      // Ensure user's upload schema and MdUploads table exist
      await this.uploadsDbService.ensureMdUploadsTable(actor);

      const schemaName = this.uploadsDbService.getUploadSchemaName(actor);

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
          userId: actor.userId,
          organizationId: actor.organizationId,
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
        await this.deleteMdUpload(actor, mdUploadId);
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
  async getMdData(uploadId: string, actor: Actor): Promise<MdUploadData> {
    const upload = await this.getUpload(uploadId, actor);

    if (upload.type !== 'MD') {
      throw new Error('Upload is not a Markdown file');
    }

    const schemaName = this.uploadsDbService.getUploadSchemaName(actor);
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
   * Create a Workbook from a CSV upload
   */
  async createWorkbookFromCsvUpload(
    uploadId: string,
    actor: Actor,
    workbookName: string,
    titleColumnRemoteId?: string[],
  ): Promise<{ workbookId: WorkbookId; tableId: string }> {
    // Get the upload
    const upload = await this.getUpload(uploadId, actor);

    if (upload.type !== 'CSV') {
      throw new Error('Upload is not a CSV file');
    }

    const workbookId = createWorkbookId();
    const tableSlug = uploadId; // Use uploadId as tableId so we can track it back to the upload
    const uploadSchemaName = this.uploadsDbService.getUploadSchemaName(actor);
    const uploadTableName = upload.typeId;

    try {
      // Get table structure from upload table
      const tableInfo = await this.uploadsDbService.knex(uploadTableName).withSchema(uploadSchemaName).columnInfo();

      const schemaParser = new CsvSchemaParser();
      // Convert table structure to table spec (exclude remoteId and timestamps - those are metadata)
      const columnNames = Object.keys(tableInfo).filter(
        (col) => col !== 'remoteId' && col !== 'createdAt' && col !== 'updatedAt',
      );

      const columns = columnNames.map((name) => {
        const colInfo = tableInfo[name];
        // Map Postgres types to our PostgresColumnType enum
        const pgType = schemaParser.getPostgresType(colInfo);
        const metadata = schemaParser.getColumnMetadata(name, colInfo);

        return {
          id: { wsId: name, remoteId: [name] },
          name: name,
          pgType,
          metadata,
          readonly: false,
        };
      });

      const tableSpecs = [
        {
          id: { wsId: tableSlug, remoteId: [uploadId] }, // Store uploadId in remoteId so we can find it
          slug: tableSlug,
          name: workbookName,
          columns,
          titleColumnRemoteId,
        },
      ] satisfies AnyTableSpec[];

      // Create table ID and name for v1 naming scheme
      const newTableId = createSnapshotTableId();
      const wsId = sanitizeForTableWsId(tableSpecs[0].name);
      const tableName = `${newTableId}_${wsId}`;

      // Create the workbook in the database
      await this.db.client.workbook.create({
        data: {
          id: workbookId,
          userId: actor.userId,
          organizationId: actor.organizationId,
          name: workbookName,

          snapshotTables: {
            create: [
              {
                id: newTableId,
                connectorAccountId: null,
                connectorService: Service.CSV,
                tableSpec: tableSpecs[0] as any,
                columnSettings: {},
                tableName,
                version: 'v1',
              },
            ],
          },
        },
      });

      // Create the workbook schema and table
      const tableSpecToIdMap = new Map<AnyTableSpec, SnapshotTableId>([[tableSpecs[0], newTableId]]);
      await this.snapshotDbService.snapshotDb.createForWorkbook(workbookId, tableSpecs, tableSpecToIdMap);

      // Copy data from upload table to snapshot table
      // Generate csr_ prefixed IDs (CSV Snapshot Record) for wsId column
      // Copy remoteId from upload table to id column in snapshot
      const copyQuery = `
        INSERT INTO "${workbookId}"."${tableName}" ("wsId", "id", ${columnNames.map((c) => `"${c}"`).join(', ')})
        SELECT
          'csr_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) as "wsId",
          "remoteId" as "id",
          ${columnNames.map((c) => `"${c}"`).join(', ')}
        FROM "${uploadSchemaName}"."${uploadTableName}"
      `;

      await this.uploadsDbService.knex.raw(copyQuery);

      console.log(`Successfully created snapshot ${workbookId} from CSV upload ${uploadId}`);

      return { workbookId, tableId: newTableId };
    } catch (error) {
      // Clean up workbook if creation failed
      try {
        await this.snapshotDbService.snapshotDb.cleanUpSnapshots(workbookId);
        await this.db.client.workbook.delete({ where: { id: workbookId } });
      } catch (cleanupError) {
        console.error('Error cleaning up failed workbook:', cleanupError);
      }

      console.error('Error creating workbook from CSV upload:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create workbook from CSV upload: ${errorMessage}`);
    }
  }
}
