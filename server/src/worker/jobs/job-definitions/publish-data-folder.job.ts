import type { PrismaClient } from '@prisma/client';
import { Service, type DataFolderId, type WorkbookId } from '@spinner/shared-types';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyJsonTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { WSLogger } from '../../../logger';
import { DataFolderPublishingService } from '../../../workbook/data-folder-publishing.service';
import { SnapshotEventService } from '../../../workbook/snapshot-event.service';

export type PublishDataFolderPublicProgress = {
  totalFilesPublished: number;
  folderId: string;
  folderName: string;
  connector: string;
  creates: number;
  updates: number;
  deletes: number;
  expectedCreates: number;
  expectedUpdates: number;
  expectedDeletes: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
};

export type PublishDataFolderJobDefinition = JobDefinitionBuilder<
  'publish-data-folder',
  {
    workbookId: WorkbookId;
    dataFolderId: DataFolderId;
    userId: string;
    organizationId: string;
    initialPublicProgress?: PublishDataFolderPublicProgress;
  },
  PublishDataFolderPublicProgress,
  Record<string, never>,
  void
>;

/**
 * This job publishes files from a single DataFolder to an external service.
 * It replaces the deprecated publish-files job which uses SnapshotTables.
 */
export class PublishDataFolderJobHandler implements JobHandlerBuilder<PublishDataFolderJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly connectorService: ConnectorsService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly dataFolderPublishingService: DataFolderPublishingService,
  ) {}

  async run(params: {
    data: PublishDataFolderJobDefinition['data'];
    progress: Progress<
      PublishDataFolderJobDefinition['publicProgress'],
      PublishDataFolderJobDefinition['initialJobProgress']
    >;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<
          PublishDataFolderJobDefinition['publicProgress'],
          PublishDataFolderJobDefinition['initialJobProgress']
        >,
        'timestamp'
      >,
    ) => Promise<void>;
  }) {
    const { data, checkpoint } = params;

    // Fetch the DataFolder with its connector account
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

    // Verify workbook exists
    const workbook = await this.prisma.workbook.findUnique({
      where: { id: data.workbookId },
    });

    if (!workbook) {
      throw new Error(`Workbook with id ${data.workbookId} not found`);
    }

    // Initialize public progress
    const publicProgress: PublishDataFolderPublicProgress = {
      totalFilesPublished: 0,
      folderId: dataFolder.id,
      folderName: dataFolder.name,
      connector: dataFolder.connectorService,
      creates: 0,
      updates: 0,
      deletes: 0,
      expectedCreates: data.initialPublicProgress?.expectedCreates ?? 0,
      expectedUpdates: data.initialPublicProgress?.expectedUpdates ?? 0,
      expectedDeletes: data.initialPublicProgress?.expectedDeletes ?? 0,
      status: 'in_progress',
    };

    // Checkpoint initial status
    await checkpoint({
      publicProgress,
      jobProgress: {},
      connectorProgress: {},
    });

    this.snapshotEventService.sendSnapshotEvent(data.workbookId, {
      type: 'sync-status-changed',
      data: {
        source: 'user',
        message: 'Publish data folder job started',
      },
    });

    WSLogger.debug({
      source: 'PublishDataFolderJob',
      message: 'Starting publish job for data folder',
      workbookId: data.workbookId,
      dataFolderId: dataFolder.id,
    });

    // Get connector for this folder
    const service = dataFolder.connectorService;

    let decryptedConnectorAccount: Awaited<ReturnType<typeof this.connectorAccountService.findOne>> | null = null;
    if (dataFolder.connectorAccountId) {
      decryptedConnectorAccount = await this.connectorAccountService.findOne(dataFolder.connectorAccountId, {
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

    try {
      // Build folder path from data folder name
      const folderPath = `/${dataFolder.name}`;

      WSLogger.debug({
        source: 'PublishDataFolderJob',
        message: 'Publishing data folder using scratch-git',
        workbookId: data.workbookId,
        dataFolderId: dataFolder.id,
        folderPath,
      });

      // Use the new DataFolderPublishingService which reads from scratch-git
      const results = await this.dataFolderPublishingService.publishAll(
        data.workbookId,
        folderPath,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        connector,
        tableSpec,
        async (phase: 'creates' | 'updates' | 'deletes', count: number) => {
          if (phase === 'creates') {
            publicProgress.creates += count;
          } else if (phase === 'updates') {
            publicProgress.updates += count;
          } else if (phase === 'deletes') {
            publicProgress.deletes += count;
          }
          publicProgress.totalFilesPublished += count;

          this.snapshotEventService.sendSnapshotEvent(data.workbookId, {
            type: 'snapshot-updated',
            data: {
              tableId: dataFolder.id,
              source: 'user',
              message: `Updating publishing counts for ${phase}`,
            },
          });

          await checkpoint({
            publicProgress,
            jobProgress: {},
            connectorProgress: {},
          });
        },
      );

      WSLogger.info({
        source: 'PublishDataFolderJob',
        message: 'Publish results',
        workbookId: data.workbookId,
        dataFolderId: dataFolder.id,
        results,
      });

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

      this.snapshotEventService.sendSnapshotEvent(data.workbookId, {
        type: 'snapshot-updated',
        data: {
          source: 'user',
          tableId: dataFolder.id,
          message: 'Publish data folder job completed',
        },
      });

      WSLogger.debug({
        source: 'PublishDataFolderJob',
        message: 'Publish completed for data folder',
        workbookId: data.workbookId,
        dataFolderId: dataFolder.id,
        creates: publicProgress.creates,
        updates: publicProgress.updates,
        deletes: publicProgress.deletes,
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

      this.snapshotEventService.sendSnapshotEvent(data.workbookId, {
        type: 'sync-status-changed',
        data: {
          source: 'user',
          tableId: dataFolder.id,
          message: 'Publish data folder job failed',
        },
      });

      WSLogger.error({
        source: 'PublishDataFolderJob',
        message: 'Failed to publish files for data folder',
        workbookId: data.workbookId,
        dataFolderId: dataFolder.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw exceptionForConnectorError(error, connector);
    }
  }
}
