import type { PrismaClient } from '@prisma/client';
import type { DataFolderId, SyncId, SyncMapping, WorkbookId } from '@spinner/shared-types';
import { WSLogger } from '../../../logger';
import { SyncService } from '../../../sync/sync.service';
import { Actor } from '../../../users/types';
import type { JsonSafeObject } from '../../../utils/objects';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';

export type SyncDataFoldersPublicProgress = {
  totalFilesSynced: number;
  tables: {
    id: string;
    name: string;
    connector: string;
    creates: number;
    updates: number;
    deletes: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }[];
};

export type SyncDataFoldersJobDefinition = JobDefinitionBuilder<
  'sync-data-folders',
  {
    workbookId: WorkbookId;
    syncId: SyncId;
    organizationId: string;
    userId: string;
    progress?: JsonSafeObject;
    initialPublicProgress?: SyncDataFoldersPublicProgress;
  },
  SyncDataFoldersPublicProgress,
  Record<string, never>, // jobProgress - empty for now
  void
>;

export class SyncDataFoldersJobHandler implements JobHandlerBuilder<SyncDataFoldersJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly syncService: SyncService,
  ) {}

  async run(params: {
    data: SyncDataFoldersJobDefinition['data'];
    progress: Progress<
      SyncDataFoldersJobDefinition['publicProgress'],
      SyncDataFoldersJobDefinition['initialJobProgress']
    >;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<SyncDataFoldersJobDefinition['publicProgress'], SyncDataFoldersJobDefinition['initialJobProgress']>,
        'timestamp'
      >,
    ) => Promise<void>;
  }) {
    const { data, checkpoint } = params;

    WSLogger.info({
      source: 'SyncDataFoldersJob',
      message: 'Starting sync data folders job',
      syncId: data.syncId,
      workbookId: data.workbookId,
      userId: data.userId,
    });

    // Load the Sync record
    const sync = await this.prisma.sync.findUnique({
      where: { id: data.syncId },
      include: {
        syncTablePairs: {
          include: {
            sourceDataFolder: true,
            destinationDataFolder: true,
          },
        },
      },
    });

    if (!sync) {
      throw new Error(`Sync with id ${data.syncId} not found`);
    }

    const syncMapping = sync.mappings as unknown as SyncMapping;
    const tableMappings = syncMapping.tableMappings ?? [];

    WSLogger.info({
      source: 'SyncDataFoldersJob',
      message: 'Loaded sync mapping',
      syncId: data.syncId,
      tableMappingCount: tableMappings.length,
    });

    // Build actor for sync service calls
    const actor: Actor = {
      userId: data.userId,
      organizationId: data.organizationId,
    };

    // Build mapping of data tables
    const dataTables = new Map(
      sync.syncTablePairs
        .flatMap((pair) => [pair.sourceDataFolder, pair.destinationDataFolder])
        .map((dt) => [dt.id as DataFolderId, dt]),
    );

    // Initialize progress tracking
    type TableProgress = SyncDataFoldersPublicProgress['tables'][number];
    const tablesProgress: TableProgress[] = tableMappings.map((tm, index) => ({
      id: tm.sourceDataFolderId,
      name: dataTables.get(tm.sourceDataFolderId)?.name ?? `Unknown data source: ${index}`,
      connector: '',
      creates: 0,
      updates: 0,
      deletes: 0,
      status: 'pending' as const,
    }));

    let totalFilesSynced = 0;

    // Process each table mapping
    for (let i = 0; i < tableMappings.length; i++) {
      const tableMapping = tableMappings[i];
      const tableProgress = tablesProgress[i];

      WSLogger.info({
        source: 'SyncDataFoldersJob',
        message: 'Starting sync for table mapping',
        syncId: data.syncId,
        tableIndex: i,
        sourceDataFolderId: tableMapping.sourceDataFolderId,
        destinationDataFolderId: tableMapping.destinationDataFolderId,
        columnMappingCount: tableMapping.columnMappings.length,
      });

      // Mark table as in_progress
      tableProgress.status = 'in_progress';
      await checkpoint({
        publicProgress: { totalFilesSynced, tables: tablesProgress },
        jobProgress: {},
        connectorProgress: {},
      });

      try {
        // Run the sync for this table mapping
        const result = await this.syncService.syncTableMapping(data.syncId, tableMapping, data.workbookId, actor);

        WSLogger.info({
          source: 'SyncDataFoldersJob',
          message: 'Completed sync for table mapping',
          syncId: data.syncId,
          tableIndex: i,
          recordsCreated: result.recordsCreated,
          recordsUpdated: result.recordsUpdated,
          errorCount: result.errors.length,
        });

        // Update progress with results
        tableProgress.creates = result.recordsCreated;
        tableProgress.updates = result.recordsUpdated;
        tableProgress.status = result.errors.length > 0 ? 'failed' : 'completed';
        totalFilesSynced += result.recordsCreated + result.recordsUpdated;

        // Log any errors
        if (result.errors.length > 0) {
          WSLogger.warn({
            source: 'SyncDataFoldersJob',
            message: 'Sync completed with errors',
            syncId: data.syncId,
            tableIndex: i,
            errors: result.errors,
          });
        }
      } catch (error) {
        WSLogger.error({
          source: 'SyncDataFoldersJob',
          message: 'Failed to sync table mapping',
          syncId: data.syncId,
          sourceDataFolderId: tableMapping.sourceDataFolderId,
          destinationDataFolderId: tableMapping.destinationDataFolderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        tableProgress.status = 'failed';
      }

      // Checkpoint after each table
      await checkpoint({
        publicProgress: { totalFilesSynced, tables: tablesProgress },
        jobProgress: {},
        connectorProgress: {},
      });
    }

    // Phase 2: Resolve FK references by re-running table mappings with FOREIGN_KEY_MAPPING phase
    for (let i = 0; i < tableMappings.length; i++) {
      const tableMapping = tableMappings[i];
      const hasFkColumns = tableMapping.columnMappings.some((m) => m.transformer?.type === 'source_fk_to_dest_fk');
      if (hasFkColumns) {
        try {
          const fkResult = await this.syncService.syncTableMapping(
            data.syncId,
            tableMapping,
            data.workbookId,
            actor,
            'FOREIGN_KEY_MAPPING',
          );

          WSLogger.info({
            source: 'SyncDataFoldersJob',
            message: 'Completed FK resolution for table mapping',
            syncId: data.syncId,
            tableIndex: i,
            recordsUpdated: fkResult.recordsUpdated,
            errorCount: fkResult.errors.length,
          });

          if (fkResult.errors.length > 0) {
            WSLogger.warn({
              source: 'SyncDataFoldersJob',
              message: 'FK resolution completed with errors',
              syncId: data.syncId,
              tableIndex: i,
              errors: fkResult.errors,
            });
            tablesProgress[i].status = 'failed';
          }
        } catch (error) {
          WSLogger.error({
            source: 'SyncDataFoldersJob',
            message: 'Failed to resolve foreign keys for table mapping',
            syncId: data.syncId,
            tableIndex: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          tablesProgress[i].status = 'failed';
        }
      }
    }

    // Checkpoint after Phase 2
    await checkpoint({
      publicProgress: { totalFilesSynced, tables: tablesProgress },
      jobProgress: {},
      connectorProgress: {},
    });

    // Update lastSyncTime on the Sync record
    const allTablesSucceeded = tablesProgress.every((t) => t.status === 'completed');
    if (allTablesSucceeded) {
      await this.prisma.sync.update({
        where: { id: data.syncId },
        data: { lastSyncTime: new Date() },
      });
    }

    WSLogger.info({
      source: 'SyncDataFoldersJob',
      message: 'Completed sync data folders job',
      syncId: data.syncId,
      workbookId: data.workbookId,
      totalFilesSynced,
      tablesProcessed: tableMappings.length,
      allTablesSucceeded,
    });
  }
}
