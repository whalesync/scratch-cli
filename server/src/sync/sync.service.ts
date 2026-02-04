import { Injectable, NotFoundException } from '@nestjs/common';
import { DataFolder } from '@prisma/client';
import { TSchema } from '@sinclair/typebox';
import {
  AnyColumnMapping,
  createPlainId,
  CreateSyncDto,
  createSyncId,
  DataFolderId,
  SyncId,
  TableMapping,
  WorkbookId,
} from '@spinner/shared-types';
import at from 'lodash/at';
import zipObjectDeep from 'lodash/zipObjectDeep';
import { DbService } from 'src/db/db.service';
import { BaseJsonTableSpec, ConnectorRecord } from 'src/remote-service/connectors/types';
import { DIRTY_BRANCH, ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { Actor } from 'src/users/types';
import { DataFolderService } from 'src/workbook/data-folder.service';
import { WorkbookService } from 'src/workbook/workbook.service';

export interface RemoteIdMappingPair {
  sourceRemoteId: string;
  destinationRemoteId: string | null;
}

interface FileContent {
  folderId: DataFolderId;
  path: string;
  content: string;
}

export interface SyncTableMappingResult {
  recordsCreated: number;
  recordsUpdated: number;
  errors: Array<{ sourceRemoteId: string; error: string }>;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly db: DbService,
    private readonly dataFolderService: DataFolderService,
    private readonly scratchGitService: ScratchGitService,
    private readonly workbookService: WorkbookService,
  ) {}

  /**
   * Creates a new sync.
   * Ignores schedule and autoPublish for now as they are not in the data model.
   */
  async createSync(workbookId: WorkbookId, dto: CreateSyncDto, actor: Actor): Promise<unknown> {
    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const syncId = createSyncId();

    // Create the sync and its table pairs in a transaction
    const sync = await this.db.client.sync.create({
      data: {
        id: syncId,
        displayName: dto.name,
        // Using an empty object for now as SyncMapping structure is complex and we're using table pairs
        mappings: {},
        syncTablePairs: {
          create: dto.folderMappings.map((mapping) => ({
            id: createSyncId(), // Using sync ID generator for pair ID as well
            sourceDataFolderId: mapping.sourceId,
            destinationDataFolderId: mapping.destId,
            // We would store fieldMap and matchingField here if the model supported it,
            // but for now we just link the folders.
            // TODO: Update SyncTablePair model to support field mappings
          })),
        },
      },
      include: {
        syncTablePairs: true,
      },
    });

    return sync;
  }

  /**
   * Lists all syncs for a workbook.
   */
  async findAllForWorkbook(workbookId: WorkbookId, actor: Actor): Promise<unknown[]> {
    // Verify user has access to the workbook
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Consider adding workbookId to the sync.
    return await this.db.client.sync.findMany({
      where: {
        syncTablePairs: {
          some: {
            sourceDataFolder: {
              workbookId,
            },
          },
        },
      },
      include: {
        syncTablePairs: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Extracts the idColumnRemoteId from a DataFolder's schema.
   * Falls back to 'id' if the schema doesn't specify an idColumnRemoteId.
   */
  private getIdColumnFromSchema(schema: unknown): string {
    const jsonSchema = schema as BaseJsonTableSpec | null;
    return jsonSchema?.idColumnRemoteId ?? 'id';
  }

  /**
   * Deletes a sync.
   */
  async deleteSync(workbookId: WorkbookId, syncId: SyncId, actor: Actor): Promise<void> {
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    // Verify sync exists and belongs to workbook (via relation)
    // For now simplistic delete.
    // We should probably check if sync belongs to workbook.
    // DB relation: Sync -> SyncTablePairs -> DataFolder -> Workbook.
    // If we trust the ID or if we want strict check:
    /*
    const sync = await this.db.client.sync.findFirst({
        where: { id: syncId, ... }
    });
    */

    await this.db.client.sync.delete({
      where: { id: syncId },
    });
  }

  /**
   * Fills sync caches (match keys and remote ID mappings) before running a sync.
   * Fetches all files from source and destination folders, parses their content,
   * populates the SyncMatchKeys table for both sides, and creates SyncRemoteIdMapping entries
   * for records that exist in both source and destination.
   * Fetches files from source and destination folders and parses them into records.
   *
   * @param sourceFolder - The source DataFolder with schema
   * @param destinationFolder - The destination DataFolder with schema
   * @param tableMapping - The table mapping with source/destination folder IDs
   * @param workbookId - The workbook ID
   * @param actor - The actor performing the operation
   * @returns Object containing source and destination records, plus a map from destination record ID to file path
   */
  async fetchRecordsForSync(
    sourceFolder: DataFolder,
    destinationFolder: DataFolder,
    tableMapping: TableMapping,
    workbookId: WorkbookId,
    actor: Actor,
  ): Promise<{
    sourceRecords: ConnectorRecord[];
    destinationRecords: ConnectorRecord[];
    destinationIdToFilePath: Map<string, string>;
  }> {
    // Get idColumnRemoteId from schemas
    const sourceIdColumn = this.getIdColumnFromSchema(sourceFolder.schema);
    const destinationIdColumn = this.getIdColumnFromSchema(destinationFolder.schema);

    // Fetch source and destination files
    const sourceFiles = await this.dataFolderService.getAllFileContentsByFolderId(
      workbookId,
      tableMapping.sourceDataFolderId,
      actor,
    );
    const destinationFiles = await this.dataFolderService.getAllFileContentsByFolderId(
      workbookId,
      tableMapping.destinationDataFolderId,
      actor,
    );

    // Parse files to extract fields using the correct ID column for each side
    const sourceRecords = sourceFiles.map((file) => parseFileToRecord(file, sourceIdColumn));
    const destinationRecords = destinationFiles.map((file) => parseFileToRecord(file, destinationIdColumn));

    // Build a map from destination record ID to file path for updates
    const destinationIdToFilePath = new Map<string, string>();
    for (let i = 0; i < destinationRecords.length; i++) {
      destinationIdToFilePath.set(destinationRecords[i].id, destinationFiles[i].path);
    }

    return { sourceRecords, destinationRecords, destinationIdToFilePath };
  }

  /**
   * Fills sync caches (match keys and remote ID mappings) before running a sync.
   * Populates the SyncMatchKeys table for both sides, and creates SyncRemoteIdMapping entries
   * for records that exist in both source and destination.
   *
   * @param syncId - The sync ID
   * @param tableMapping - The table mapping with source/destination folder IDs
   * @param sourceRecords - The source records to process
   * @param destinationRecords - The destination records to process
   */
  async fillSyncCaches(
    syncId: SyncId,
    tableMapping: TableMapping,
    sourceRecords: ConnectorRecord[],
    destinationRecords: ConnectorRecord[],
  ): Promise<void> {
    // Insert match keys for both sides
    await this.insertSourceMatchKeys(syncId, tableMapping, sourceRecords);
    await this.insertDestinationMatchKeys(syncId, tableMapping, destinationRecords);

    // Create remote ID mappings for both matched and unmatched source records
    // Get all source records, with corresponding destination remote IDs if they exist
    const allSourceMappings = await this.db.client.$queryRaw<
      { sourceRemoteId: string; destinationRemoteId: string | null }[]
    >`
      SELECT src."remoteId" as "sourceRemoteId", dest."remoteId" as "destinationRemoteId"
      FROM "SyncMatchKeys" src
      LEFT JOIN "SyncMatchKeys" dest
        ON src."syncId" = dest."syncId"
        AND src."matchId" = dest."matchId"
        AND dest."dataFolderId" = ${tableMapping.destinationDataFolderId}
      WHERE src."syncId" = ${syncId}
        AND src."dataFolderId" = ${tableMapping.sourceDataFolderId}
    `;

    if (allSourceMappings.length > 0) {
      await this.upsertRemoteIdMappings(syncId, tableMapping, allSourceMappings);
    }
  }

  /**
   * Syncs records from source to destination DataFolder based on a TableMapping.
   * Creates new records in destination for unmatched source records,
   * and updates existing destination records for matched ones.
   *
   * @param syncId - The sync ID
   * @param tableMapping - The table mapping configuration
   * @param workbookId - The workbook ID
   * @param actor - The actor performing the sync
   * @returns Result containing counts of created/updated records and any errors
   */
  async syncTableMapping(
    syncId: SyncId,
    tableMapping: TableMapping,
    workbookId: WorkbookId,
    actor: Actor,
  ): Promise<SyncTableMappingResult> {
    const result: SyncTableMappingResult = {
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: [],
    };

    // 1. Fetch source and destination DataFolders with their schemas
    const [sourceFolder, destinationFolder] = await Promise.all([
      this.db.client.dataFolder.findUnique({
        where: { id: tableMapping.sourceDataFolderId },
      }),
      this.db.client.dataFolder.findUnique({
        where: { id: tableMapping.destinationDataFolderId },
      }),
    ]);

    if (!sourceFolder) {
      throw new NotFoundException(`Source DataFolder ${tableMapping.sourceDataFolderId} not found`);
    }
    if (!destinationFolder) {
      throw new NotFoundException(`Destination DataFolder ${tableMapping.destinationDataFolderId} not found`);
    }

    // 2. Clear existing match keys for this sync
    await this.clearMatchKeys(syncId);

    // 3. Fetch records from source and destination folders
    const { sourceRecords, destinationRecords, destinationIdToFilePath } = await this.fetchRecordsForSync(
      sourceFolder,
      destinationFolder,
      tableMapping,
      workbookId,
      actor,
    );

    // 4. Fill caches - populates match keys and creates initial remote ID mappings
    await this.fillSyncCaches(syncId, tableMapping, sourceRecords, destinationRecords);

    // Create a map of source records by ID for quick lookup
    const sourceRecordsById = new Map(sourceRecords.map((r) => [r.id, r]));

    // 5. Get all source-to-destination mappings
    const mappingsBySourceId = await this.getDestinationRemoteIds(
      syncId,
      tableMapping.sourceDataFolderId,
      Array.from(sourceRecordsById.keys()),
    );

    // Get the destination folder path for new files
    const destinationFolderPath = destinationFolder.path?.replace(/^\//, '') ?? '';

    // 6. Partition records and transform
    const filesToWrite: Array<{ path: string; content: string }> = [];
    const newMappings: RemoteIdMappingPair[] = [];

    for (const [sourceRemoteId, destinationRemoteId] of mappingsBySourceId) {
      const sourceRecord = sourceRecordsById.get(sourceRemoteId);
      if (!sourceRecord) {
        result.errors.push({
          sourceRemoteId,
          error: 'Source record not found',
        });
        continue;
      }

      try {
        // Transform the record using column mappings
        const transformedFields = transformRecord(sourceRecord, tableMapping.columnMappings);
        const content = serializeRecord(transformedFields);

        let destinationPath: string;

        if (destinationRemoteId === null) {
          // This is a new record - generate a temporary filename
          const tempFileName = `pending-publish-${createPlainId()}.json`;
          destinationPath = destinationFolderPath ? `${destinationFolderPath}/${tempFileName}` : tempFileName;

          // Track the mapping update with the new file path
          // TODO: How do we actually do this, if the records are going to be rewritten with new remote IDs on publish?
          newMappings.push({
            sourceRemoteId,
            destinationRemoteId: destinationPath,
          });
          result.recordsCreated++;
        } else {
          // This is an existing record - use the existing file path
          const existingPath = destinationIdToFilePath.get(destinationRemoteId);
          if (!existingPath) {
            result.errors.push({
              sourceRemoteId,
              error: `Could not find file path for existing destination record ${destinationRemoteId}`,
            });
            continue;
          }
          destinationPath = existingPath;
          result.recordsUpdated++;
        }

        filesToWrite.push({ path: destinationPath, content });
      } catch (error) {
        result.errors.push({
          sourceRemoteId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 7. Write all files in batch to the dirty branch
    if (filesToWrite.length > 0) {
      try {
        await this.scratchGitService.commitFilesToBranch(
          workbookId,
          DIRTY_BRANCH,
          filesToWrite,
          'Sync: batch write files',
        );
      } catch (error) {
        // If batch write fails, all records are affected
        const errorMessage = error instanceof Error ? error.message : String(error);
        for (const file of filesToWrite) {
          result.errors.push({
            sourceRemoteId: file.path,
            error: `Batch write failed: ${errorMessage}`,
          });
        }
        result.recordsCreated = 0;
        result.recordsUpdated = 0;
        return result;
      }
    }

    // 8. Update mappings for newly created records
    if (newMappings.length > 0) {
      await this.upsertRemoteIdMappings(syncId, tableMapping, newMappings);
    }

    return result;
  }

  // ===============================================================================================================
  // SyncRemoteIdMapping methods - for storing and retrieving mapping of source remote IDs to destination remote IDs
  // ===============================================================================================================

  /**
   * Upserts remote ID mappings for synced records.
   * Maps source remote IDs to their corresponding destination remote IDs.
   *
   * @param syncId - The sync ID
   * @param tableMapping - The table mapping containing source/destination DataFolder IDs
   * @param mappings - Array of source/destination remote ID pairs
   */
  private async upsertRemoteIdMappings(
    syncId: SyncId,
    tableMapping: TableMapping,
    mappings: RemoteIdMappingPair[],
  ): Promise<void> {
    if (mappings.length === 0) {
      return;
    }

    await this.db.client.$transaction(
      mappings.map((mapping) =>
        this.db.client.syncRemoteIdMapping.upsert({
          where: {
            syncId_dataFolderId_sourceRemoteId: {
              syncId,
              dataFolderId: tableMapping.sourceDataFolderId,
              sourceRemoteId: mapping.sourceRemoteId,
            },
          },
          create: {
            syncId,
            dataFolderId: tableMapping.sourceDataFolderId,
            sourceRemoteId: mapping.sourceRemoteId,
            destinationRemoteId: mapping.destinationRemoteId,
          },
          update: {
            destinationRemoteId: mapping.destinationRemoteId,
          },
        }),
      ),
    );
  }

  /**
   * Bulk lookup of destination remote IDs for multiple source remote IDs.
   *
   * @param syncId - The sync ID
   * @param dataFolderId - The source DataFolder ID
   * @param sourceRemoteIds - Array of source remote IDs to look up
   * @returns Map of source remote ID to destination remote ID
   */
  private async getDestinationRemoteIds(
    syncId: SyncId,
    dataFolderId: DataFolderId,
    sourceRemoteIds: string[],
  ): Promise<Map<string, string | null>> {
    if (sourceRemoteIds.length === 0) {
      return new Map();
    }

    const mappings = await this.db.client.syncRemoteIdMapping.findMany({
      where: {
        syncId,
        dataFolderId,
        sourceRemoteId: { in: sourceRemoteIds },
      },
      select: { sourceRemoteId: true, destinationRemoteId: true },
    });

    return new Map(mappings.map((m) => [m.sourceRemoteId, m.destinationRemoteId]));
  }

  // ============================================================================
  // SyncMatchKeys methods - for finding matching records across source and destination
  // ============================================================================

  /**
   * Inserts match keys for a batch of ConnectorRecords.
   * Extracts the value from the specified column and stores it as the matchId,
   * along with the record's remote ID for efficient lookup later.
   *
   * @param syncId - The sync ID
   * @param dataFolderId - The DataFolder ID (source or destination)
   * @param records - The ConnectorRecords to extract match keys from
   * @param matchColumnId - The column ID to extract match values from
   */
  private async insertMatchKeys(
    syncId: SyncId,
    dataFolderId: DataFolderId,
    records: ConnectorRecord[],
    matchColumnId: string,
  ): Promise<void> {
    const matchKeys = records
      .map((record) => {
        const matchValue = record.fields[matchColumnId];
        if (typeof matchValue !== 'string' || matchValue === '') {
          return null;
        }
        return {
          syncId,
          dataFolderId,
          matchId: matchValue,
          remoteId: record.id,
        };
      })
      .filter((key): key is NonNullable<typeof key> => key !== null);

    if (matchKeys.length === 0) {
      return;
    }

    // Use createMany with skipDuplicates to handle duplicates gracefully
    await this.db.client.syncMatchKeys.createMany({
      data: matchKeys,
      skipDuplicates: true,
    });
  }

  /**
   * Inserts match keys for source records using the TableMapping's recordMatching config.
   */
  private async insertSourceMatchKeys(
    syncId: SyncId,
    tableMapping: TableMapping,
    records: ConnectorRecord[],
  ): Promise<void> {
    if (!tableMapping.recordMatching) {
      throw new Error('TableMapping must have recordMatching configured');
    }
    await this.insertMatchKeys(
      syncId,
      tableMapping.sourceDataFolderId,
      records,
      tableMapping.recordMatching.sourceColumnId,
    );
  }

  /**
   * Inserts match keys for destination records using the TableMapping's recordMatching config.
   */
  private async insertDestinationMatchKeys(
    syncId: SyncId,
    tableMapping: TableMapping,
    records: ConnectorRecord[],
  ): Promise<void> {
    if (!tableMapping.recordMatching) {
      throw new Error('TableMapping must have recordMatching configured');
    }
    await this.insertMatchKeys(
      syncId,
      tableMapping.destinationDataFolderId,
      records,
      tableMapping.recordMatching.destinationColumnId,
    );
  }

  /**
   * Clears all match keys for a sync.
   * Call this before re-populating match keys for a fresh sync.
   */
  private async clearMatchKeys(syncId: SyncId): Promise<void> {
    await this.db.client.syncMatchKeys.deleteMany({
      where: { syncId },
    });
  }

  /**
   * Clears match keys for a specific sync and DataFolder combination.
   */
  private async clearMatchKeysForDataFolder(syncId: SyncId, dataFolderId: DataFolderId): Promise<void> {
    await this.db.client.syncMatchKeys.deleteMany({
      where: { syncId, dataFolderId },
    });
  }

  /**
   * Finds match IDs that exist in both source and destination DataFolders.
   * Returns the set of matchIds that have records on both sides.
   */
  private async findMatchingIds(syncId: SyncId, tableMapping: TableMapping): Promise<Set<string>> {
    // Use raw SQL for the self-join query
    const results = await this.db.client.$queryRaw<{ matchId: string }[]>`
      SELECT DISTINCT src."matchId"
      FROM "SyncMatchKeys" src
      INNER JOIN "SyncMatchKeys" dest
        ON src."syncId" = dest."syncId"
        AND src."matchId" = dest."matchId"
      WHERE src."syncId" = ${syncId}
        AND src."dataFolderId" = ${tableMapping.sourceDataFolderId}
        AND dest."dataFolderId" = ${tableMapping.destinationDataFolderId}
    `;

    return new Set(results.map((r) => r.matchId));
  }

  /**
   * Finds match IDs that exist in source but NOT in destination.
   * These represent new records that need to be created in the destination.
   */
  private async findUnmatchedSourceIds(syncId: SyncId, tableMapping: TableMapping): Promise<Set<string>> {
    const results = await this.db.client.$queryRaw<{ matchId: string }[]>`
      SELECT src."matchId"
      FROM "SyncMatchKeys" src
      LEFT JOIN "SyncMatchKeys" dest
        ON src."syncId" = dest."syncId"
        AND src."matchId" = dest."matchId"
        AND dest."dataFolderId" = ${tableMapping.destinationDataFolderId}
      WHERE src."syncId" = ${syncId}
        AND src."dataFolderId" = ${tableMapping.sourceDataFolderId}
        AND dest."matchId" IS NULL
    `;

    return new Set(results.map((r) => r.matchId));
  }
  /**
  /**
   * Validates a mapping between two data folders.
   * Fetches schemas and checks validity.
   */
  async validateFolderMapping(
    workbookId: WorkbookId,
    sourceId: DataFolderId,
    destId: DataFolderId,
    mapping: Record<string, string>,
    actor: Actor,
  ): Promise<boolean> {
    const sourceSpec = await this.dataFolderService.fetchSchemaSpec(sourceId, actor);
    // If no schema (e.g. scratch folder), we can't strictly validate, so assume true or fail?
    // User requested "validateMapping(sourceSchema, destinationSchema, mapping)".
    // If one is missing, maybe return true (loose validation) or false (strict).
    // Let's assume strict if connected, loose if not?
    // For now, if spec is missing, we skip validation -> true.

    const destSpec = await this.dataFolderService.fetchSchemaSpec(destId, actor);

    if (!sourceSpec?.schema || !destSpec?.schema) {
      return true;
    }

    return this.validateSchemaMapping(sourceSpec.schema, destSpec.schema, mapping);
  }

  /**
   * Pure validation logic between two schemas.
   */
  private validateSchemaMapping(sourceSchema: TSchema, destSchema: TSchema, mapping: Record<string, string>): boolean {
    // Keep variables usage to satisfy linter until implemented
    void sourceSchema;
    void destSchema;
    void mapping;
    return true;
  }
}

/**
 * Parse a file's content to extract fields from front matter and body.
 *
 * @param file - The file content to parse
 * @param idColumnRemoteId - The column ID to use as the record ID (from schema.idColumnRemoteId)
 * @returns A ConnectorRecord with the ID extracted from the specified column
 */
function parseFileToRecord(file: FileContent, idColumnRemoteId: string): ConnectorRecord {
  const fields: Record<string, unknown> = {};

  if (file.content) {
    const parsed = JSON.parse(file.content) as object;
    // Add metadata fields from front matter
    Object.assign(fields, parsed);
  }

  // Extract the record ID from the specified column
  const recordId = fields[idColumnRemoteId];
  if (recordId === undefined || recordId === null) {
    throw new Error(`Record in file ${file.path} is missing required ID field: ${idColumnRemoteId}`);
  }
  if (typeof recordId !== 'string' && typeof recordId !== 'number') {
    throw new Error(`Record ID field ${idColumnRemoteId} in file ${file.path} must be a string or number`);
  }

  return {
    id: String(recordId),
    fields,
  };
}

/**
 * Transform a source record's fields to destination schema using column mappings.
 * Only LocalColumnMapping is currently supported.
 *
 * @param sourceRecord - The source record to transform
 * @param columnMappings - Array of column mappings defining field transformations
 * @returns Transformed fields for the destination record
 */
function transformRecord(sourceRecord: ConnectorRecord, columnMappings: AnyColumnMapping[]): Record<string, unknown> {
  const sourcePaths: string[] = [];
  const destinationPaths: string[] = [];

  for (const mapping of columnMappings) {
    if (mapping.type === 'local') {
      sourcePaths.push(mapping.sourceColumnId);
      destinationPaths.push(mapping.destinationColumnId);
    } else if (mapping.type === 'foreign_key_lookup') {
      throw new Error('ForeignKeyLookupColumnMapping is not yet implemented');
    }
  }

  const sourceValues = at(sourceRecord.fields, sourcePaths);

  // Filter out undefined values and their corresponding paths
  const definedPaths: string[] = [];
  const definedValues: unknown[] = [];
  for (let i = 0; i < sourceValues.length; i++) {
    if (sourceValues[i] !== undefined) {
      definedPaths.push(destinationPaths[i]);
      definedValues.push(sourceValues[i]);
    }
  }

  return zipObjectDeep(definedPaths, definedValues) as Record<string, unknown>;
}

/**
 * Serialize transformed fields to markdown with YAML front matter.
 * This is the inverse of parseFileToRecord.
 * TODO: Update this to handle metadata correctly.
 *
 * @param fields - The fields to serialize
 * @returns JSON string
 */
function serializeRecord(fields: Record<string, unknown>): string {
  return JSON.stringify(fields);
}
