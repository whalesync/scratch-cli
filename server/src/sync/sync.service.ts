import { Injectable } from '@nestjs/common';
import { DataFolderId, SyncId, TableMapping, WorkbookId } from '@spinner/shared-types';
import matter from 'gray-matter';
import { DbService } from 'src/db/db.service';
import { ConnectorRecord } from 'src/remote-service/connectors/types';
import { Actor } from 'src/users/types';
import { FilesService } from 'src/workbook/files.service';

export interface RemoteIdMappingPair {
  sourceRemoteId: string;
  destinationRemoteId: string | null;
}

interface FileContent {
  folderId: DataFolderId;
  path: string;
  content: string;
}

@Injectable()
export class SyncService {
  constructor(
    private readonly db: DbService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Fills sync caches (match keys and remote ID mappings) before running a sync.
   * Fetches all files from source and destination folders, parses their content,
   * populates the SyncMatchKeys table for both sides, and creates SyncRemoteIdMapping entries
   * for records that exist in both source and destination.
   *
   * @param syncId - The sync ID
   * @param tableMapping - The table mapping with source/destination folder IDs
   * @param workbookId - The workbook ID
   * @returns Object containing source and destination records for further processing
   */
  async fillSyncCaches(
    syncId: SyncId,
    tableMapping: TableMapping,
    workbookId: WorkbookId,
    actor: Actor,
  ): Promise<{ sourceRecords: Record<string, unknown>[]; destinationRecords: Record<string, unknown>[] }> {
    // Fetch source and destination files
    const sourceFiles = await this.filesService.getAllFileContentsByFolderId(
      workbookId,
      tableMapping.sourceDataFolderId,
      actor,
    );
    const destinationFiles = await this.filesService.getAllFileContentsByFolderId(
      workbookId,
      tableMapping.destinationDataFolderId,
      actor,
    );

    // Parse files to extract fields
    const sourceRecords = sourceFiles.map((file) => parseFileToRecord(file));
    const destinationRecords = destinationFiles.map((file) => parseFileToRecord(file));

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

    return { sourceRecords, destinationRecords };
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
  ): Promise<Map<string, string>> {
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

    return new Map(
      mappings.flatMap((m) => (m.destinationRemoteId !== null ? [[m.sourceRemoteId, m.destinationRemoteId]] : [])),
    );
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
}

/**
 * Parse a file's content to extract fields from front matter and body.
 * TODO: Properly parse ConnectorRecords once there's an interface for converting them from git data.
 */
function parseFileToRecord(file: FileContent): ConnectorRecord {
  const fields: Record<string, unknown> = {};

  if (file.content) {
    const parsed = matter(file.content);
    // Add metadata fields from front matter
    Object.assign(fields, parsed.data);
  }

  return {
    id: file.path, // Use path as the ID
    fields,
  };
}
