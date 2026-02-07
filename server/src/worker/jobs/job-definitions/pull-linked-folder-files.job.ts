import type { PrismaClient } from '@prisma/client';
import { DataFolderId, Service, type WorkbookId } from '@spinner/shared-types';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyJsonTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { ConnectorFile } from '../../../remote-service/connectors/types';
import type { JsonSafeObject } from '../../../utils/objects';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import _ from 'lodash';
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { MAIN_BRANCH, RepoFileRef, ScratchGitService } from 'src/scratch-git/scratch-git.service';
import { deduplicateFileName, resolveBaseFileName } from 'src/workbook/util';
import { WSLogger } from '../../../logger';
import { WorkbookEventService } from '../../../workbook/workbook-event.service';

export type PullLinkedFolderFilesPublicProgress = {
  totalFiles: number;
  folderId: string;
  folderName: string;
  connector: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
};

export type PullLinkedFolderFilesJobDefinition = JobDefinitionBuilder<
  'pull-linked-folder-files',
  {
    workbookId: WorkbookId;
    dataFolderId: DataFolderId;
    userId: string;
    organizationId: string;
    progress?: JsonSafeObject;
    initialPublicProgress?: PullLinkedFolderFilesPublicProgress;
  },
  PullLinkedFolderFilesPublicProgress,
  Record<string, never>,
  void
>;

/**
 * This job pulls records as ConnectorFiles for a single DataFolder (linked folder)
 */
export class PullLinkedFolderFilesJobHandler implements JobHandlerBuilder<PullLinkedFolderFilesJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly connectorService: ConnectorsService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly workbookEventService: WorkbookEventService,
    private readonly scratchGitService: ScratchGitService,
  ) {}

  /**
   * Constructs git file payloads from connector files, applying slug > title > id naming.
   * Deduplicates filenames across the entire pull (maintained in usedFileNames across batches).
   */
  private buildGitFilesFromConnectorFiles(
    parentPath: string,
    records: ConnectorFile[],
    tableSpec: AnyJsonTableSpec,
    usedFileNames: Set<string>,
  ): { path: string; content: string }[] {
    const prefix = parentPath === '/' ? '' : parentPath;
    const idColumnRemoteId = tableSpec.idColumnRemoteId;
    const processedFiles: { path: string; content: string }[] = [];

    for (const record of records) {
      const content = JSON.stringify(record, null, 2);
      const recordId = String(record[idColumnRemoteId]);

      // Resolve filename: slug > title > id
      const slugValue = tableSpec.slugColumnRemoteId
        ? (_.get(record, tableSpec.slugColumnRemoteId) as string | undefined)
        : undefined;
      const titleValue = tableSpec.titleColumnRemoteId
        ? (_.get(record, tableSpec.titleColumnRemoteId[0]) as string | undefined)
        : undefined;

      const baseName = resolveBaseFileName({ slugValue, titleValue, idValue: recordId });
      const fileName = deduplicateFileName(baseName, '.json', usedFileNames, recordId);
      const fullPath = `${prefix}/${fileName}`;

      processedFiles.push({ path: fullPath, content });
    }

    return processedFiles;
  }

  async run(params: {
    data: PullLinkedFolderFilesJobDefinition['data'];
    progress: Progress<
      PullLinkedFolderFilesJobDefinition['publicProgress'],
      PullLinkedFolderFilesJobDefinition['initialJobProgress']
    >;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<
          PullLinkedFolderFilesJobDefinition['publicProgress'],
          PullLinkedFolderFilesJobDefinition['initialJobProgress']
        >,
        'timestamp'
      >,
    ) => Promise<void>;
  }) {
    const { data, checkpoint, progress } = params;

    const dataFolder = await this.prisma.dataFolder.findUnique({
      where: { id: data.dataFolderId },
      include: {
        connectorAccount: true,
      },
    });

    if (!dataFolder) {
      throw new Error(`DataFolder with id ${data.dataFolderId} not found`);
    }

    if (!dataFolder.connectorAccountId) {
      throw new Error(`DataFolder ${data.dataFolderId} does not have an associated connector account`);
    }

    if (!dataFolder.connectorService) {
      throw new Error(`DataFolder ${data.dataFolderId} does not have a connector service`);
    }

    const tableSpec = dataFolder.schema as AnyJsonTableSpec;

    const publicProgress: PullLinkedFolderFilesPublicProgress = {
      totalFiles: 0,
      folderId: dataFolder.id,
      folderName: dataFolder.name,
      connector: dataFolder.connectorService,
      status: 'active',
    };

    // Checkpoint initial status
    await checkpoint({
      publicProgress,
      jobProgress: {},
      connectorProgress: {},
    });

    WSLogger.debug({
      source: 'PullLinkedFolderFilesJob',
      message: 'Pulling files for data folder',
      workbookId: dataFolder.workbookId,
      dataFolderId: dataFolder.id,
    });

    // Get connector for this folder
    const service = dataFolder.connectorService;

    let decryptedConnectorAccount: Awaited<ReturnType<typeof this.connectorAccountService.findOneById>> | null = null;
    if (dataFolder.connectorAccountId) {
      decryptedConnectorAccount = await this.connectorAccountService.findOneById(dataFolder.connectorAccountId, {
        userId: data.userId,
        organizationId: data.organizationId,
      });
      if (!decryptedConnectorAccount) {
        throw new Error(`Connector account ${dataFolder.connectorAccountId} not found`);
      }
    }

    const connector = await this.connectorService.getConnector({
      service: service as Service,
      connectorAccount: decryptedConnectorAccount,
      decryptedCredentials: decryptedConnectorAccount,
      userId: data.userId,
    });

    let gitFiles: { path: string; content: string }[] = [];
    const usedFileNames = new Set<string>();
    const callback = async (params: { files: ConnectorFile[]; connectorProgress?: JsonSafeObject }) => {
      const { files, connectorProgress } = params;

      WSLogger.debug({
        source: 'PullLinkedFolderFilesJob',
        message: 'Received files from connector',
        workbookId: dataFolder.workbookId,
        dataFolderId: dataFolder.id,
        fileCount: files.length,
        folderPath: dataFolder.path,
      });

      // Build git file payloads from connector files
      const builtFiles = this.buildGitFilesFromConnectorFiles(dataFolder.path ?? '', files, tableSpec, usedFileNames);

      // Sync to Git (Commit to main + Rebase dirty)
      if (builtFiles.length > 0) {
        const batchGitFiles = builtFiles.map((f) => ({
          path: f.path.startsWith('/') ? f.path.slice(1) : f.path,
          content: f.content,
        }));

        // Accumulate for deletion tracking
        gitFiles = gitFiles.concat(batchGitFiles);

        try {
          await this.scratchGitService.commitFilesToBranch(
            dataFolder.workbookId as WorkbookId,
            'main',
            batchGitFiles,
            `Sync batch of ${builtFiles.length} files`,
          );

          await this.scratchGitService.rebaseDirty(dataFolder.workbookId as WorkbookId);
        } catch (err) {
          WSLogger.error({
            source: 'PullLinkedFolderFilesJob',
            message: 'Failed to sync batch to git',
            workbookId: dataFolder.workbookId,
            error: err,
          });
        }
      }

      publicProgress.totalFiles += files.length;

      this.workbookEventService.sendWorkbookEvent(dataFolder.workbookId as WorkbookId, {
        type: 'workbook-updated',
        data: {
          tableId: dataFolder.id,
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

      // After download, remove files from main that no longer exist in remote
      // This ensures deleted items don't keep showing up in future diffs
      const folderPath = dataFolder.name;
      try {
        const mainFiles = (await this.scratchGitService.listRepoFiles(
          dataFolder.workbookId as WorkbookId,
          MAIN_BRANCH,
          folderPath,
        )) as RepoFileRef[];
        const downloadedFilePaths = gitFiles.map((f) => f.path);
        const filesToDelete = mainFiles.filter((f) => !downloadedFilePaths.includes(f.path)).map((f) => f.path);

        if (filesToDelete.length > 0) {
          WSLogger.debug({
            source: 'DownloadLinkedFolderFilesJob',
            message: 'Removing deleted files from main branch',
            workbookId: dataFolder.workbookId,
            dataFolderId: dataFolder.id,
            filesToDelete,
          });

          await this.scratchGitService.deleteFilesFromBranch(
            dataFolder.workbookId as WorkbookId,
            MAIN_BRANCH,
            filesToDelete,
            `Remove ${filesToDelete.length} deleted files from ${folderPath}`,
          );

          await this.scratchGitService.rebaseDirty(dataFolder.workbookId as WorkbookId);
        }
      } catch (err) {
        WSLogger.error({
          source: 'DownloadLinkedFolderFilesJob',
          message: 'Failed to clean up deleted files from main',
          workbookId: dataFolder.workbookId,
          error: err,
        });
        // Don't fail the job for cleanup errors
      }

      // Mark as completed
      publicProgress.status = 'completed';

      // Checkpoint final status
      await checkpoint({
        publicProgress,
        jobProgress: {},
        connectorProgress: {},
      });

      // Set lock=null and update lastSyncTime on success
      await this.prisma.dataFolder.update({
        where: { id: dataFolder.id },
        data: {
          lock: null,
          lastSyncTime: new Date(),
        },
      });

      WSLogger.debug({
        source: 'PullLinkedFolderFilesJob',
        message: 'Pull completed for data folder',
        workbookId: dataFolder.workbookId,
        dataFolderId: dataFolder.id,
      });

      this.workbookEventService.sendWorkbookEvent(dataFolder.workbookId as WorkbookId, {
        type: 'workbook-updated',
        data: {
          tableId: dataFolder.id,
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
      await this.prisma.dataFolder.update({
        where: { id: dataFolder.id },
        data: { lock: null },
      });

      WSLogger.error({
        source: 'PullLinkedFolderFilesJob',
        message: 'Failed to pull files for data folder',
        workbookId: dataFolder.workbookId,
        dataFolderId: dataFolder.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw exceptionForConnectorError(error, connector);
    }
  }
}
