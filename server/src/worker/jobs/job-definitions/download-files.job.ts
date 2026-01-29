import type { PrismaClient } from '@prisma/client';
import { FolderId, Service, type WorkbookId } from '@spinner/shared-types';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { ConnectorRecord } from '../../../remote-service/connectors/types';
import type { JsonSafeObject } from '../../../utils/objects';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { WorkbookDb } from 'src/workbook/workbook-db';
import { WSLogger } from '../../../logger';
import { ScratchGitService } from '../../../scratch-git/scratch-git.service';
import { SnapshotEventService } from '../../../workbook/snapshot-event.service';
import type { SnapshotColumnSettingsMap } from '../../../workbook/types';

export type DownloadFilesPublicProgress = {
  totalFiles: number;
  folders: {
    id: string; // folderId
    name: string; // folder name
    connector: string; // connector service name
    files: number; // files downloaded count
    status: 'pending' | 'active' | 'completed' | 'failed';
    hasDirtyDiscoveredDeletes?: boolean;
  }[];
};

export type DownloadFilesJobDefinition = JobDefinitionBuilder<
  'download-files',
  {
    workbookId: WorkbookId;
    snapshotTableIds?: string[]; // Optional: if provided, only download these tables
    userId: string;
    organizationId: string;
    progress?: JsonSafeObject;
    initialPublicProgress?: DownloadFilesPublicProgress;
  },
  DownloadFilesPublicProgress,
  { index: number },
  void
>;

export class DownloadFilesJobHandler implements JobHandlerBuilder<DownloadFilesJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly connectorService: ConnectorsService,
    private readonly workbookDb: WorkbookDb,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly scratchGitService: ScratchGitService,
  ) {}

  /**
   * Resets the 'seen' flag to false for all records in a table and files in folder before starting a download
   * Excludes records with __old_remote_id set (discovered deletes that shouldn't be reprocessed)
   */
  private async resetSeenFlags(workbookId: WorkbookId, { folderId }: { tableName: string; folderId: FolderId }) {
    // Reset seen flags for files in the folder
    await this.workbookDb.resetSeenFlagForFolder(workbookId, folderId);
  }

  async run(params: {
    data: DownloadFilesJobDefinition['data'];
    progress: Progress<DownloadFilesJobDefinition['publicProgress'], DownloadFilesJobDefinition['initialJobProgress']>;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<DownloadFilesJobDefinition['publicProgress'], DownloadFilesJobDefinition['initialJobProgress']>,
        'timestamp'
      >,
    ) => Promise<void>;
  }) {
    const { data, checkpoint, progress } = params;
    const workbook = await this.prisma.workbook.findUnique({
      where: { id: data.workbookId },
      include: {
        snapshotTables: {
          include: {
            connectorAccount: true,
            folder: true,
          },
        },
      },
    });

    if (!workbook) {
      throw new Error(`Workbook with id ${data.workbookId} not found`);
    }

    // Filter to snapshot tables that have folders
    let snapshotTablesToProcess = (workbook.snapshotTables || []).filter((st) => st.folderId);
    if (data.snapshotTableIds && data.snapshotTableIds.length > 0) {
      snapshotTablesToProcess = snapshotTablesToProcess.filter((st) => data.snapshotTableIds!.includes(st.id));
      if (snapshotTablesToProcess.length === 0) {
        throw new Error(`No SnapshotTables with folders found with the provided IDs in workbook ${data.workbookId}`);
      }
    }

    // Lock is already set when enqueuing the job

    WSLogger.debug({
      source: 'DownloadFilesJob',
      message: 'Set lock=download for tables with folders',
      workbookId: workbook.id,
      tableCount: snapshotTablesToProcess.length,
    });

    type FolderToProcess = {
      id: string;
      name: string;
      connector: string;
      files: number;
      status: 'pending' | 'active' | 'completed' | 'failed';
      hasDirtyDiscoveredDeletes?: boolean;
    };

    // Create FolderToProcess array for snapshot tables to process
    const foldersToProcess: FolderToProcess[] = snapshotTablesToProcess.map((snapshotTable) => ({
      id: snapshotTable.folderId!,
      name: snapshotTable.folder?.name ?? (snapshotTable.tableSpec as AnyTableSpec).name,
      connector: snapshotTable.connectorService,
      files: 0,
      status: 'pending' as const,
    }));

    let totalFiles = 0;

    // Process each snapshot table with its own connector
    for (let i = 0; i < snapshotTablesToProcess.length; i++) {
      const snapshotTable = snapshotTablesToProcess[i];
      const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
      const currentFolder = foldersToProcess[i];

      // Mark folder as active
      currentFolder.status = 'active';

      // Checkpoint initial status for this folder
      await checkpoint({
        publicProgress: {
          totalFiles,
          folders: foldersToProcess,
        },
        jobProgress: {
          index: i,
        },
        connectorProgress: {},
      });

      WSLogger.debug({
        source: 'DownloadFilesJob',
        message: 'Downloading files for folder',
        workbookId: workbook.id,
        snapshotTableId: snapshotTable.id,
        folderId: snapshotTable.folderId,
      });

      // Reset the 'seen' flag to false for all records/files before starting the download
      await this.resetSeenFlags(workbook.id as WorkbookId, {
        folderId: snapshotTable.folderId as FolderId,
        tableName: snapshotTable.tableName,
      });

      // Get connector for this specific table
      const service = snapshotTable.connectorService;

      let decryptedConnectorAccount: Awaited<ReturnType<typeof this.connectorAccountService.findOne>> | null = null;
      if (snapshotTable.connectorAccountId) {
        decryptedConnectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, {
          userId: data.userId,
          organizationId: data.organizationId,
        });
        if (!decryptedConnectorAccount) {
          throw new Error(`Connector account ${snapshotTable.connectorAccountId} not found`);
        }
      }

      const connector = await this.connectorService.getConnector({
        service: service as Service,
        connectorAccount: decryptedConnectorAccount,
        decryptedCredentials: decryptedConnectorAccount,
        userId: data.userId,
      });

      const callback = async (params: { records: ConnectorRecord[]; connectorProgress?: JsonSafeObject }) => {
        const { records, connectorProgress } = params;

        WSLogger.debug({
          source: 'DownloadFilesJob',
          message: 'Received records from connector',
          workbookId: workbook.id,
          folderId: snapshotTable.folderId,
          recordCount: records.length,
          folderPath: snapshotTable.folder?.path,
        });

        // Upsert files from connector records
        // Upsert files from connector records
        const upsertedFiles = await this.workbookDb.upsertFilesFromConnectorRecords(
          workbook.id as WorkbookId,
          snapshotTable.folderId ?? '',
          snapshotTable.folder?.path ?? '',
          records,
          tableSpec,
        );

        // Sync to Git (Commit to main + Rebase dirty)
        if (upsertedFiles.length > 0) {
          const gitFiles = upsertedFiles.map((f) => ({
            path: f.path.startsWith('/') ? f.path.slice(1) : f.path,
            content: f.content,
          }));

          try {
            await this.scratchGitService.commitFilesToBranch(
              workbook.id as WorkbookId,
              'main',
              gitFiles,
              `Sync batch of ${upsertedFiles.length} files`,
            );

            await this.scratchGitService.rebaseDirty(workbook.id as WorkbookId);
          } catch (err) {
            WSLogger.error({
              source: 'DownloadFilesJob',
              message: 'Failed to sync batch to git',
              workbookId: workbook.id,
              error: err,
            });
            // Should we throw? If git sync fails, but DB succeeded?
            // User requirement "We have to... make a commit".
            // If git fails, the sync is incomplete.
            // Maybe just log for now to avoid breaking the whole job if git is flaky?
            // But if we fail to commit, 'main' is behind. Future rebases might be weird.
            // I'll leave it as non-fatal but logged error, consistent with "best effort" backup.
          }
        }

        currentFolder.files += records.length;
        totalFiles += records.length;

        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            tableId: snapshotTable.id,
            source: 'user',
          },
        });

        await checkpoint({
          publicProgress: {
            totalFiles,
            folders: foldersToProcess,
          },
          jobProgress: {
            index: i,
          },
          connectorProgress: connectorProgress ?? {},
        });
      };

      try {
        await connector.downloadTableRecords(
          tableSpec,
          (snapshotTable.columnSettings as SnapshotColumnSettingsMap) ?? {},
          callback,
          progress,
        );

        // Mark folder as completed
        currentFolder.status = 'completed';

        // Checkpoint final status for this folder
        await checkpoint({
          publicProgress: {
            totalFiles,
            folders: foldersToProcess,
          },
          jobProgress: {
            index: i + 1,
          },
          connectorProgress: {},
        });

        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            tableId: snapshotTable.id,
            source: 'agent',
          },
        });

        // Delete records that weren't seen in this sync (__seen=false or undefined)
        // const { hadDirtyRecords } = await this.snapshotDb.handleUnseenRecords(
        //   workbook.id as WorkbookId,
        //   snapshotTable.tableName,
        // );

        // // Track folders that had dirty discovered deletes
        // if (hadDirtyRecords) {
        //   currentFolder.hasDirtyDiscoveredDeletes = true;
        //   // Checkpoint to update the UI with the dirty discovered deletes warning
        //   await checkpoint({
        //     publicProgress: {
        //       totalFiles,
        //       folders: foldersToProcess,
        //     },
        //     jobProgress: {
        //       index: i + 1,
        //     },
        //     connectorProgress: {},
        //   });
        // }

        // Set lock=null and update lastSyncTime for this table on success
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: {
            lock: null,
            lastSyncTime: new Date(),
          },
        });

        WSLogger.debug({
          source: 'DownloadFilesJob',
          message: 'Download completed for folder',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
          folderId: snapshotTable.folderId,
        });

        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            tableId: snapshotTable.id,
            source: 'agent',
          },
        });
      } catch (error) {
        // Mark folder as failed
        currentFolder.status = 'failed';

        // Checkpoint failed status for this folder
        await checkpoint({
          publicProgress: {
            totalFiles,
            folders: foldersToProcess,
          },
          jobProgress: {
            index: i,
          },
          connectorProgress: {},
        });

        // Set lock=null for this table on failure
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: { lock: null },
        });

        WSLogger.error({
          source: 'DownloadFilesJob',
          message: 'Failed to download files for folder',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
          folderId: snapshotTable.folderId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw exceptionForConnectorError(error, connector);
      }
    }
  }
}
