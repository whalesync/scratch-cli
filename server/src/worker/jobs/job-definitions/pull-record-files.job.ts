import type { PrismaClient } from '@prisma/client';
import { FolderId, Service, type WorkbookId } from '@spinner/shared-types';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyJsonTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { ConnectorFile } from '../../../remote-service/connectors/types';
import type { JsonSafeObject } from '../../../utils/objects';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { WorkbookDb } from 'src/workbook/workbook-db';
import { WSLogger } from '../../../logger';
import { SnapshotEventService } from '../../../workbook/snapshot-event.service';

export type PullRecordFilesPublicProgress = {
  totalFiles: number;
  folderId: string;
  folderName: string;
  connector: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
};

export type PullRecordFilesJobDefinition = JobDefinitionBuilder<
  'pull-record-files',
  {
    workbookId: WorkbookId;
    snapshotTableId: string;
    userId: string;
    organizationId: string;
    progress?: JsonSafeObject;
    initialPublicProgress?: PullRecordFilesPublicProgress;
  },
  PullRecordFilesPublicProgress,
  Record<string, never>,
  void
>;

/**
 * This is the new job that will pull records as ConnectorFiles for a single Linked Table
 */
export class PullRecordFilesJobHandler implements JobHandlerBuilder<PullRecordFilesJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly connectorService: ConnectorsService,
    private readonly workbookDb: WorkbookDb,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly scratchGitService: ScratchGitService,
  ) {}

  async run(params: {
    data: PullRecordFilesJobDefinition['data'];
    progress: Progress<
      PullRecordFilesJobDefinition['publicProgress'],
      PullRecordFilesJobDefinition['initialJobProgress']
    >;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<PullRecordFilesJobDefinition['publicProgress'], PullRecordFilesJobDefinition['initialJobProgress']>,
        'timestamp'
      >,
    ) => Promise<void>;
  }) {
    const { data, checkpoint, progress } = params;

    const snapshotTable = await this.prisma.snapshotTable.findUnique({
      where: { id: data.snapshotTableId },
      include: {
        connectorAccount: true,
        folder: true,
        workbook: true,
      },
    });

    if (!snapshotTable) {
      throw new Error(`SnapshotTable with id ${data.snapshotTableId} not found`);
    }

    if (!snapshotTable.folderId) {
      throw new Error(`SnapshotTable ${data.snapshotTableId} does not have an associated folder`);
    }

    const tableSpec = snapshotTable.tableSpec as AnyJsonTableSpec;

    const publicProgress: PullRecordFilesPublicProgress = {
      totalFiles: 0,
      folderId: snapshotTable.folderId,
      folderName: snapshotTable.folder?.name ?? tableSpec.name,
      connector: snapshotTable.connectorService,
      status: 'active',
    };

    // Checkpoint initial status
    await checkpoint({
      publicProgress,
      jobProgress: {},
      connectorProgress: {},
    });

    WSLogger.debug({
      source: 'PullRecordFilesJob',
      message: 'Pulling record files for folder',
      workbookId: snapshotTable.workbookId,
      snapshotTableId: snapshotTable.id,
      folderId: snapshotTable.folderId,
    });

    // Reset seen flags for files in the folder
    await this.workbookDb.resetSeenFlagForFolder(
      snapshotTable.workbookId as WorkbookId,
      snapshotTable.folderId as FolderId,
    );

    // Get connector for this table
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

    const callback = async (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => {
      const { files, connectorProgress } = params;

      WSLogger.debug({
        source: 'PullRecordFilesJob',
        message: 'Received files from connector',
        workbookId: snapshotTable.workbookId,
        folderId: snapshotTable.folderId,
        fileCount: files.length,
        folderPath: snapshotTable.folder?.path,
      });

      // Upsert files from connector files
      const upsertedFiles = await this.workbookDb.upsertFilesFromConnectorFiles(
        snapshotTable.workbookId as WorkbookId,
        snapshotTable.folderId!,
        snapshotTable.folder?.path ?? '',
        files,
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
            snapshotTable.workbookId as WorkbookId,
            'main',
            gitFiles,
            `Sync batch of ${upsertedFiles.length} files`,
          );

          await this.scratchGitService.rebaseDirty(snapshotTable.workbookId as WorkbookId);
        } catch (err) {
          WSLogger.error({
            source: 'PullRecordFilesJob',
            message: 'Failed to sync batch to git',
            workbookId: snapshotTable.workbookId,
            error: err,
          });
        }
      }

      publicProgress.totalFiles += files.length;

      this.snapshotEventService.sendSnapshotEvent(snapshotTable.workbookId as WorkbookId, {
        type: 'snapshot-updated',
        data: {
          tableId: snapshotTable.id,
          source: 'user',
        },
      });

      await checkpoint({
        publicProgress,
        jobProgress: {},
        connectorProgress: connectorProgress ?? {},
      });
    };

    try {
      await connector.pullRecordFiles(tableSpec, callback, progress);

      // Mark as completed
      publicProgress.status = 'completed';

      // Checkpoint final status
      await checkpoint({
        publicProgress,
        jobProgress: {},
        connectorProgress: {},
      });

      // Set lock=null and update lastSyncTime on success
      await this.prisma.snapshotTable.update({
        where: { id: snapshotTable.id },
        data: {
          lock: null,
          lastSyncTime: new Date(),
        },
      });

      WSLogger.debug({
        source: 'PullRecordFilesJob',
        message: 'Pull completed for folder',
        workbookId: snapshotTable.workbookId,
        snapshotTableId: snapshotTable.id,
        folderId: snapshotTable.folderId,
      });

      this.snapshotEventService.sendSnapshotEvent(snapshotTable.workbookId as WorkbookId, {
        type: 'snapshot-updated',
        data: {
          tableId: snapshotTable.id,
          source: 'agent',
        },
      });
    } catch (error) {
      // Mark as failed
      publicProgress.status = 'failed';

      // Checkpoint failed status
      await checkpoint({
        publicProgress,
        jobProgress: {},
        connectorProgress: {},
      });

      // Set lock=null on failure
      await this.prisma.snapshotTable.update({
        where: { id: snapshotTable.id },
        data: { lock: null },
      });

      WSLogger.error({
        source: 'PullRecordFilesJob',
        message: 'Failed to pull record files for folder',
        workbookId: snapshotTable.workbookId,
        snapshotTableId: snapshotTable.id,
        folderId: snapshotTable.folderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw exceptionForConnectorError(error, connector);
    }
  }
}
