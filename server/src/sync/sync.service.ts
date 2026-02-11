import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataFolder, Prisma } from '@prisma/client';
import { TSchema } from '@sinclair/typebox';
import {
  ColumnMapping,
  createScratchPendingPublishId,
  CreateSyncDto,
  createSyncId,
  DataFolderId,
  FieldMappingValue,
  FieldMapType,
  LookupFieldOptions,
  SyncId,
  TableMapping,
  UpdateSyncDto,
  WorkbookId,
} from '@spinner/shared-types';
import get from 'lodash/get';
import merge from 'lodash/merge';
import set from 'lodash/set';
import zipObjectDeep from 'lodash/zipObjectDeep';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { PostHogService } from 'src/posthog/posthog.service';
import { BaseJsonTableSpec } from 'src/remote-service/connectors/types';
import { DIRTY_BRANCH, ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { validateSchemaMapping } from 'src/sync/schema-validator';
import {
  createLookupTools,
  getTransformer,
  LookupTools,
  SyncPhase,
  SyncRecord,
  TransformContext,
} from 'src/sync/transformers';
import { Actor } from 'src/users/types';
import { formatJsonWithPrettier } from 'src/utils/json-formatter';
import { DataFolderService } from 'src/workbook/data-folder.service';
import { deduplicateFileName, resolveBaseFileName } from 'src/workbook/util';
import { WorkbookService } from 'src/workbook/workbook.service';

/**
 * Converts a FieldMapType entry to a ColumnMapping.
 * Handles both simple string mappings and complex FieldMappingValue objects.
 */
function fieldMapEntryToColumnMapping(sourceField: string, value: string | FieldMappingValue): ColumnMapping {
  if (typeof value === 'string') {
    return {
      sourceColumnId: sourceField,
      destinationColumnId: value,
    };
  }
  return {
    sourceColumnId: sourceField,
    destinationColumnId: value.destinationField,
    transformer: value.transformer,
  };
}

/**
 * Converts a FieldMapType to an array of ColumnMapping.
 */
function fieldMapToColumnMappings(fieldMap: FieldMapType): ColumnMapping[] {
  return Object.entries(fieldMap).map(([sourceField, value]) => fieldMapEntryToColumnMapping(sourceField, value));
}

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
    private readonly posthogService: PostHogService,
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

    // Validate mappings
    for (const mapping of dto.folderMappings) {
      const sourceId = mapping.sourceId as DataFolderId;
      const destId = mapping.destId as DataFolderId;

      const sourceFolder = await this.dataFolderService.fetchSchemaSpec(sourceId, actor);
      const destFolder = await this.dataFolderService.fetchSchemaSpec(destId, actor);

      if (!sourceFolder?.schema) {
        throw new NotFoundException(`Source folder schema not found for ${mapping.sourceId}`);
      }
      if (!destFolder?.schema) {
        throw new NotFoundException(`Destination folder schema not found for ${mapping.destId}`);
      }

      const errors = validateSchemaMapping(sourceFolder.schema, destFolder.schema, mapping.fieldMap);
      if (errors.length > 0) {
        throw new BadRequestException(`Validation failed for folder mapping: ${errors.join('; ')}`);
      }
    }

    const syncId = createSyncId();

    // Create the sync and its table pairs in a transaction
    const sync = await this.db.client.sync.create({
      data: {
        id: syncId,
        displayName: dto.name,
        // Create SyncMapping structure
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        mappings: {
          version: 1,
          tableMappings: dto.folderMappings.map((mapping) => {
            const columnMappings = fieldMapToColumnMappings(mapping.fieldMap);

            const tableMapping: TableMapping = {
              sourceDataFolderId: mapping.sourceId as DataFolderId,
              destinationDataFolderId: mapping.destId as DataFolderId,
              columnMappings,
            };

            if (mapping.matchingDestinationField && mapping.matchingSourceField) {
              tableMapping.recordMatching = {
                sourceColumnId: mapping.matchingSourceField,
                destinationColumnId: mapping.matchingDestinationField,
              };
            }
            return tableMapping;
          }),
        } as any,
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

    this.posthogService.trackCreateSync(actor, sync);
    return sync;
  }

  /**
   * Updates an existing sync.
   * Replaces mapped folders and settings.
   */
  async updateSync(workbookId: WorkbookId, syncId: SyncId, dto: UpdateSyncDto, actor: Actor): Promise<unknown> {
    const workbook = await this.workbookService.findOne(workbookId, actor);
    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }

    const sync = await this.db.client.sync.findFirst({
      where: { id: syncId },
    });
    if (!sync) {
      throw new NotFoundException('Sync not found');
    }

    // Validate mappings if validation is enabled (default true)
    if (dto.enableValidation !== false) {
      for (const mapping of dto.folderMappings) {
        const sourceId = mapping.sourceId as DataFolderId;
        const destId = mapping.destId as DataFolderId;

        const sourceFolder = await this.dataFolderService.fetchSchemaSpec(sourceId, actor);
        const destFolder = await this.dataFolderService.fetchSchemaSpec(destId, actor);

        if (!sourceFolder?.schema) {
          throw new NotFoundException(`Source folder schema not found for ${mapping.sourceId}`);
        }
        if (!destFolder?.schema) {
          throw new NotFoundException(`Destination folder schema not found for ${mapping.destId}`);
        }

        const errors = validateSchemaMapping(sourceFolder.schema, destFolder.schema, mapping.fieldMap);
        if (errors.length > 0) {
          throw new BadRequestException(`Validation failed for folder mapping: ${errors.join('; ')}`);
        }
      }
    }

    // Transaction to update sync details and replace mappings
    const updated = await this.db.client.$transaction(async (tx) => {
      // 1. Delete existing table pairs
      await tx.syncTablePair.deleteMany({
        where: { syncId },
      });

      // 2. Update sync and create new pairs
      return tx.sync.update({
        where: { id: syncId },
        data: {
          displayName: dto.name,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          mappings: {
            version: 1,
            tableMappings: dto.folderMappings.map((mapping) => {
              const columnMappings = fieldMapToColumnMappings(mapping.fieldMap);

              const tableMapping: TableMapping = {
                sourceDataFolderId: mapping.sourceId as DataFolderId,
                destinationDataFolderId: mapping.destId as DataFolderId,
                columnMappings,
              };

              if (mapping.matchingDestinationField) {
                tableMapping.recordMatching = {
                  sourceColumnId: mapping.matchingSourceField || 'id',
                  destinationColumnId: mapping.matchingDestinationField,
                };
              }
              return tableMapping;
            }),
          } as any,
          syncTablePairs: {
            create: dto.folderMappings.map((mapping) => ({
              id: createSyncId(),
              sourceDataFolderId: mapping.sourceId,
              destinationDataFolderId: mapping.destId,
            })),
          },
        },
        include: {
          syncTablePairs: true,
        },
      });
    });

    this.posthogService.trackUpdateSync(actor, updated);
    return updated;
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

    const sync = await this.db.client.sync.findFirst({
      where: { id: syncId, syncTablePairs: { some: { sourceDataFolder: { workbookId } } } },
    });
    if (!sync) {
      throw new NotFoundException('Sync not found');
    }

    await this.db.client.sync.delete({
      where: { id: syncId },
    });

    this.posthogService.trackRemoveSync(actor, sync);
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
    sourceRecords: SyncRecord[];
    destinationRecords: SyncRecord[];
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
    sourceRecords: SyncRecord[],
    destinationRecords: SyncRecord[],
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
   * Populates the SyncForeignKeyRecord cache for lookup_field transformers.
   * For each column mapping that uses a lookup_field transformer, this method:
   * 1. Fetches all records from the referenced DataFolder
   * 2. Extracts unique FK values from the source records
   * 3. Caches the referenced record data in SyncForeignKeyRecord
   *
   * This must be called before transformation so that lookupFieldFromFkRecord()
   * can resolve FK values to field values from the referenced records.
   */
  private async populateForeignKeyRecordCache(
    syncId: SyncId,
    tableMapping: TableMapping,
    sourceRecords: SyncRecord[],
    workbookId: WorkbookId,
    actor: Actor,
  ): Promise<void> {
    const lookupFieldMappings = tableMapping.columnMappings.filter((m) => m.transformer?.type === 'lookup_field');

    if (lookupFieldMappings.length === 0) {
      return;
    }

    // Clear existing FK record cache for this sync
    await this.db.client.syncForeignKeyRecord.deleteMany({ where: { syncId } });

    // Group mappings by referenced data folder to avoid duplicate fetches
    const byFolder = new Map<DataFolderId, ColumnMapping[]>();
    for (const mapping of lookupFieldMappings) {
      const opts = mapping.transformer!.options as LookupFieldOptions;
      const arr = byFolder.get(opts.referencedDataFolderId) ?? [];
      arr.push(mapping);
      byFolder.set(opts.referencedDataFolderId, arr);
    }

    for (const [referencedFolderId, mappings] of byFolder) {
      // Fetch the referenced DataFolder for its schema
      const folder = await this.db.client.dataFolder.findUnique({
        where: { id: referencedFolderId },
      });
      if (!folder) {
        WSLogger.warn({
          source: 'SyncService',
          message: `Referenced DataFolder ${referencedFolderId} not found for lookup_field transformer`,
        });
        continue;
      }

      // Fetch and parse records from the referenced DataFolder
      const idColumn = this.getIdColumnFromSchema(folder.schema);
      const files = await this.dataFolderService.getAllFileContentsByFolderId(workbookId, referencedFolderId, actor);
      const records = files.map((f) => parseFileToRecord(f, idColumn));
      const recordsById = new Map(records.map((r) => [r.id, r.fields]));

      // Collect all unique FK values across all columns that reference this folder
      const fkValues = new Set<string>();
      for (const mapping of mappings) {
        for (const record of sourceRecords) {
          const val = record.fields[mapping.sourceColumnId];
          if (val === null || val === undefined) continue;
          if (Array.isArray(val)) {
            for (const elem of val) {
              if (elem !== null && elem !== undefined && (typeof elem === 'string' || typeof elem === 'number')) {
                fkValues.add(String(elem));
              }
            }
          } else if (typeof val === 'string' || typeof val === 'number') {
            fkValues.add(String(val));
          }
        }
      }

      // Create one cache entry per unique (dataFolderId, foreignKeyValue)
      const entries: Array<{
        syncId: string;
        dataFolderId: string;
        foreignKeyValue: string;
        recordData: Prisma.InputJsonValue;
      }> = [];

      for (const fkValue of fkValues) {
        const recordData = recordsById.get(fkValue);
        if (!recordData) continue;
        entries.push({
          syncId,
          dataFolderId: referencedFolderId,
          foreignKeyValue: fkValue,
          recordData: recordData as Prisma.InputJsonValue,
        });
      }

      if (entries.length > 0) {
        await this.db.client.syncForeignKeyRecord.createMany({
          data: entries,
          skipDuplicates: true,
        });
      }
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
    phase: SyncPhase = 'DATA',
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

    // 2. Clear existing match keys for this sync's table mapping
    await this.clearMatchKeysForDataFolder(syncId, tableMapping.sourceDataFolderId);
    await this.clearMatchKeysForDataFolder(syncId, tableMapping.destinationDataFolderId);

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

    // 4a. Populate FK record cache for lookup_field transformers (DATA phase only)
    if (phase === 'DATA') {
      await this.populateForeignKeyRecordCache(syncId, tableMapping, sourceRecords, workbookId, actor);
    }

    // Create maps of records by ID for quick lookup
    const sourceRecordsById = new Map(sourceRecords.map((r) => [r.id, r]));
    const destinationRecordsById = new Map(destinationRecords.map((r) => [r.id, r]));

    // 5. Get all source-to-destination mappings
    const mappingsBySourceId = await this.getDestinationRemoteIds(
      syncId,
      tableMapping.sourceDataFolderId,
      Array.from(sourceRecordsById.keys()),
    );

    // Check for source records that weren't included in mappings (missing or falsy match key)
    if (tableMapping.recordMatching) {
      for (const [sourceId, sourceRecord] of sourceRecordsById) {
        if (!mappingsBySourceId.has(sourceId)) {
          const matchKeyValue = sourceRecord.fields[tableMapping.recordMatching.sourceColumnId];
          if (matchKeyValue === undefined || matchKeyValue === null) {
            result.errors.push({
              sourceRemoteId: sourceId,
              error: `Source record missing record matching field: ${tableMapping.recordMatching.sourceColumnId}`,
            });
          } else if (typeof matchKeyValue !== 'string' || matchKeyValue === '') {
            result.errors.push({
              sourceRemoteId: sourceId,
              error: `Source record has empty or invalid record matching value for field: ${tableMapping.recordMatching.sourceColumnId}`,
            });
          }
        }
      }
    }

    // Get the destination folder path for new files
    const destinationFolderPath = destinationFolder.path?.replace(/^\//, '') ?? '';

    // Get the destination idColumnRemoteId from schema
    const destIdColumn = this.getIdColumnFromSchema(destinationFolder.schema);

    // 6. Partition records and transform
    const filesToWrite: Array<{ path: string; content: string }> = [];

    // Build a set of existing destination filenames for dedup
    const usedDestFileNames = new Set<string>(
      Array.from(destinationIdToFilePath.values()).map((p) => p.split('/').pop()!),
    );

    // Get destination table spec for slug resolution
    const destTableSpec = destinationFolder.schema as BaseJsonTableSpec | null;

    // Create lookup tools for transformers that need FK resolution
    const lookupTools = createLookupTools(this.db, syncId);

    // Track new records so we can backfill SyncRemoteIdMapping with their temp IDs
    const newRecordMappings: Array<{ sourceRemoteId: string; tempId: string }> = [];

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
        const transformedFields = await transformRecordAsync(
          sourceRecord,
          tableMapping.columnMappings,
          lookupTools,
          phase,
        );

        let destinationPath: string;

        if (destinationRemoteId === null) {
          // This is a new record - inject match key so subsequent syncs can find it
          if (tableMapping.recordMatching) {
            const destColumnId = tableMapping.recordMatching.destinationColumnId;
            const sourceMatchValue = sourceRecord.fields[tableMapping.recordMatching.sourceColumnId];

            // Fail if source match key is missing or falsy
            if (sourceMatchValue === undefined || sourceMatchValue === null) {
              result.errors.push({
                sourceRemoteId,
                error: `Source record missing match key field: ${tableMapping.recordMatching.sourceColumnId}`,
              });
              continue;
            }
            if (typeof sourceMatchValue !== 'string' || sourceMatchValue === '') {
              result.errors.push({
                sourceRemoteId,
                error: `Source record has empty or invalid match key for field: ${tableMapping.recordMatching.sourceColumnId}`,
              });
              continue;
            }

            // Skip injection if column mappings already populated this field (user config wins)
            if (get(transformedFields, destColumnId) === undefined) {
              set(transformedFields, destColumnId, sourceMatchValue);
            }
          }

          // Generate a temporary ID for the new record so it can be matched on subsequent syncs
          const tempId = createScratchPendingPublishId();
          set(transformedFields, destIdColumn, tempId);

          // Track this new record mapping for Phase 2 FK resolution
          newRecordMappings.push({ sourceRemoteId, tempId });

          // Resolve filename: prefer slug from destination schema, fall back to temp ID
          const slugValue = destTableSpec?.slugColumnRemoteId
            ? (get(transformedFields, destTableSpec.slugColumnRemoteId) as string | undefined)
            : undefined;
          const baseName = resolveBaseFileName({ slugValue, idValue: tempId });
          const fileName = deduplicateFileName(baseName, '.json', usedDestFileNames, tempId);
          destinationPath = destinationFolderPath ? `${destinationFolderPath}/${fileName}` : fileName;

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

          // Merge existing destination fields with transformed source fields (source takes precedence).
          // This preserves destination fields that aren't covered by column mappings.
          const existingRecord = destinationRecordsById.get(destinationRemoteId);
          if (existingRecord) {
            Object.assign(transformedFields, merge({}, existingRecord.fields, transformedFields));
          }

          result.recordsUpdated++;
        }

        const content = serializeRecord(transformedFields);
        filesToWrite.push({ path: destinationPath, content });
      } catch (error) {
        result.errors.push({
          sourceRemoteId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 7. Backfill SyncRemoteIdMapping for newly created records with their temp IDs
    // This is needed so Phase 2 FK resolution can find destination IDs for new records
    if (newRecordMappings.length > 0) {
      await this.updateRemoteIdMappingsForNewRecords(syncId, tableMapping.sourceDataFolderId, newRecordMappings);
    }

    // 8. Write all files in batch to the dirty branch
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
   * Updates SyncRemoteIdMapping entries for newly created records with their destination temp IDs.
   * During Phase 1, new records have destinationRemoteId = null. This backfills them with the
   * generated temp ID so Phase 2 FK resolution can find them.
   */
  private async updateRemoteIdMappingsForNewRecords(
    syncId: SyncId,
    dataFolderId: DataFolderId,
    newRecords: Array<{ sourceRemoteId: string; tempId: string }>,
  ): Promise<void> {
    if (newRecords.length === 0) {
      return;
    }

    await this.db.client.$transaction(
      newRecords.map((record) =>
        this.db.client.syncRemoteIdMapping.update({
          where: {
            syncId_dataFolderId_sourceRemoteId: {
              syncId,
              dataFolderId,
              sourceRemoteId: record.sourceRemoteId,
            },
          },
          data: {
            destinationRemoteId: record.tempId,
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
   * Inserts match keys for a batch of SyncRecords.
   * Extracts the value from the specified column and stores it as the matchId,
   * along with the record's remote ID for efficient lookup later.
   *
   * @param syncId - The sync ID
   * @param dataFolderId - The DataFolder ID (source or destination)
   * @param records - The SyncRecords to extract match keys from
   * @param matchColumnId - The column ID to extract match values from
   */
  private async insertMatchKeys(
    syncId: SyncId,
    dataFolderId: DataFolderId,
    records: SyncRecord[],
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
    records: SyncRecord[],
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
    records: SyncRecord[],
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
 * @returns A SyncRecord with the ID extracted from the specified column
 */
function parseFileToRecord(file: FileContent, idColumnRemoteId: string): SyncRecord {
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
 * Supports ColumnMapping with optional transformers.
 *
 * @param sourceRecord - The source record to transform
 * @param columnMappings - Array of column mappings defining field transformations
 * @param lookupTools - Tools for FK lookups (optional, required for FK transformers)
 * @returns Transformed fields for the destination record
 */
async function transformRecordAsync(
  sourceRecord: SyncRecord,
  columnMappings: ColumnMapping[],
  lookupTools?: LookupTools,
  phase: SyncPhase = 'DATA',
): Promise<Record<string, unknown>> {
  const definedPaths: string[] = [];
  const definedValues: unknown[] = [];

  for (const mapping of columnMappings) {
    const sourceValue = get(sourceRecord.fields, mapping.sourceColumnId);

    // Skip undefined source values
    if (sourceValue === undefined) {
      continue;
    }

    let transformedValue: unknown = sourceValue;
    let skip = false;

    // Apply transformer if configured
    if (mapping.transformer) {
      const transformer = getTransformer(mapping.transformer.type);
      if (transformer) {
        // Create transform context
        const ctx: TransformContext = {
          sourceRecord,
          sourceFieldPath: mapping.sourceColumnId,
          sourceValue,
          lookupTools: lookupTools ?? {
            getDestinationIdForSourceFk: () => Promise.resolve(null),
            lookupFieldFromFkRecord: () => Promise.resolve(null),
          },
          options: mapping.transformer.options ?? {},
          phase,
        };

        const result = await transformer.transform(ctx);

        if (result.success) {
          if (result.skip) {
            skip = true;
          }
          transformedValue = result.value;
        } else {
          if (result.useOriginal) {
            transformedValue = sourceValue;
          }
          WSLogger.error({
            source: 'transformRecordAsync',
            message: 'Failed to transform field',
            error: result.error,
            transformerType: mapping.transformer.type,
            sourceColumnId: mapping.sourceColumnId,
            sourceRecordId: sourceRecord.id,
          });
          throw new Error(`Failed to transform field "${mapping.sourceColumnId}": ${result.error}`);
        }
      } else {
        WSLogger.error({
          source: 'transformRecordAsync',
          message: `Unknown transformer type: ${mapping.transformer.type}`,
          transformerType: mapping.transformer.type,
          sourceColumnId: mapping.sourceColumnId,
          sourceRecordId: sourceRecord.id,
        });
      }
    }

    if (!skip) {
      definedPaths.push(mapping.destinationColumnId);
      definedValues.push(transformedValue);
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
 * @returns JSON string formatted with Prettier
 */
function serializeRecord(fields: Record<string, unknown>): string {
  return formatJsonWithPrettier(fields);
}
