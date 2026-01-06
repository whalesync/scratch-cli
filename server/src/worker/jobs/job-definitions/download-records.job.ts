import type { PrismaClient } from '@prisma/client';
import { Service, type WorkbookId } from '@spinner/shared-types';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { ConnectorRecord } from '../../../remote-service/connectors/types';
import type { JsonSafeObject } from '../../../utils/objects';
import type { SnapshotDb } from '../../../workbook/snapshot-db';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { WorkbookDb } from 'src/workbook/workbook-db';
import { WSLogger } from '../../../logger';
import { SnapshotEventService } from '../../../workbook/snapshot-event.service';
import type { SnapshotColumnSettingsMap } from '../../../workbook/types';

export type DownloadRecordsPublicProgress = {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    connector: string;
    records: number;
    status: 'pending' | 'active' | 'completed' | 'failed';
    hasDirtyDiscoveredDeletes?: boolean; // Optional flag for tables that had dirty records preventing deletion
  }[];
};
export type DownloadRecordsJobDefinition = JobDefinitionBuilder<
  'download-records',
  {
    workbookId: WorkbookId;
    snapshotTableIds?: string[]; // Optional: if provided, only download these tables
    userId: string;
    organizationId: string;
    progress?: JsonSafeObject;
    initialPublicProgress?: DownloadRecordsPublicProgress;
  },
  DownloadRecordsPublicProgress,
  { index: number },
  void
>;

export class DownloadRecordsJobHandler implements JobHandlerBuilder<DownloadRecordsJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly connectorService: ConnectorsService,
    private readonly snapshotDb: SnapshotDb,
    private readonly workbookDb: WorkbookDb,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
  ) {}

  /**
   * Resets the 'seen' flag to false for all records in a table before starting a download
   * Excludes records with __old_remote_id set (discovered deletes that shouldn't be reprocessed)
   */
  private async resetSeenFlags(
    workbookId: WorkbookId,
    { folderId, tableName }: { folderId: string; tableName: string },
  ) {
    await this.snapshotDb.getKnex().withSchema(workbookId).table(tableName).whereNull('__old_remote_id').update({
      __seen: false,
    });

    await this.workbookDb.resetSeenFlagForFolder(workbookId, folderId);
  }

  async run(params: {
    data: DownloadRecordsJobDefinition['data'];
    progress: Progress<
      DownloadRecordsJobDefinition['publicProgress'],
      DownloadRecordsJobDefinition['initialJobProgress']
    >;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<DownloadRecordsJobDefinition['publicProgress'], DownloadRecordsJobDefinition['initialJobProgress']>,
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
          },
        },
      },
    });

    if (!workbook) {
      throw new Error(`Workbook with id ${data.workbookId} not found`);
    }

    // Filter snapshot tables if specific tables are requested
    let snapshotTablesToProcess = workbook.snapshotTables || [];
    if (data.snapshotTableIds && data.snapshotTableIds.length > 0) {
      snapshotTablesToProcess = snapshotTablesToProcess.filter((st) => data.snapshotTableIds!.includes(st.id));
      if (snapshotTablesToProcess.length === 0) {
        throw new Error(`No SnapshotTables found with the provided IDs in workbook ${data.workbookId}`);
      }
    }

    // Lock is already set when enqueuing the job
    // await this.prisma.snapshotTable.updateMany({
    //   where: {
    //     id: { in: snapshotTablesToProcess.map((st) => st.id) },
    //   },
    //   data: {
    //     lock: 'download',
    //   },
    // });

    WSLogger.debug({
      source: 'DownloadRecordsJob',
      message: 'Set lock=download for tables',
      workbookId: workbook.id,
      tableCount: snapshotTablesToProcess.length,
    });

    type TableToProcess = {
      id: string;
      name: string;
      connector: string;
      records: number;
      status: 'pending' | 'active' | 'completed' | 'failed';
      hasDirtyDiscoveredDeletes?: boolean;
    };

    // Create TableToProcess array for snapshot tables to process
    const tablesToProcess: TableToProcess[] = snapshotTablesToProcess.map((snapshotTable) => ({
      id: (snapshotTable.tableSpec as AnyTableSpec).id.wsId,
      name: (snapshotTable.tableSpec as AnyTableSpec).name,
      connector: snapshotTable.connectorService,
      records: 0,
      status: 'pending' as const,
    }));

    let totalRecords = 0;

    // Process each snapshot table with its own connector
    for (let i = 0; i < snapshotTablesToProcess.length; i++) {
      const snapshotTable = snapshotTablesToProcess[i];
      const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
      const currentTable = tablesToProcess[i];

      // Mark table as active
      currentTable.status = 'active';

      // Checkpoint initial status for this table
      await checkpoint({
        publicProgress: {
          totalRecords,
          tables: tablesToProcess,
        },
        jobProgress: {
          index: i,
        },
        connectorProgress: {},
      });

      WSLogger.debug({
        source: 'DownloadRecordsJob',
        message: 'Downloading records for table',
        workbookId: workbook.id,
        snapshotTableId: snapshotTable.id,
      });

      // Reset the 'seen' flag to false for all records before starting the download
      await this.resetSeenFlags(workbook.id as WorkbookId, {
        folderId: snapshotTable.folderId ?? '',
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
        await this.snapshotDb.upsertRecords(
          workbook.id as WorkbookId,
          { spec: tableSpec, tableName: snapshotTable.tableName },
          records,
        );

        // const folderPath = snapshotTable.path ? snapshotTable.path : '/' + snapshotTable.id;

        await this.workbookDb.upsertFilesFromConnectorRecords(
          workbook.id as WorkbookId,
          snapshotTable.folderId ?? '',
          records,
          tableSpec,
        );

        currentTable.records += records.length;
        totalRecords += records.length;

        // TODO(ivan): Centralize this outside of the job.
        // Probably in the processor there the callback is being handeled.
        // That way we don't have to inject the event service in the job handler
        // and handling will be more uniform across all jobs.
        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            tableId: snapshotTable.id,
            source: 'user',
          },
        });

        await checkpoint({
          publicProgress: {
            totalRecords,
            tables: tablesToProcess,
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

        // Mark table as completed
        currentTable.status = 'completed';

        // Checkpoint final status for this table
        await checkpoint({
          publicProgress: {
            totalRecords,
            tables: tablesToProcess,
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
        const { hadDirtyRecords } = await this.snapshotDb.handleUnseenRecords(
          workbook.id as WorkbookId,
          snapshotTable.tableName,
        );

        // Track tables that had dirty discovered deletes
        if (hadDirtyRecords) {
          currentTable.hasDirtyDiscoveredDeletes = true;
          // Checkpoint to update the UI with the dirty discovered deletes warning
          await checkpoint({
            publicProgress: {
              totalRecords,
              tables: tablesToProcess,
            },
            jobProgress: {
              index: i + 1,
            },
            connectorProgress: {},
          });
        }

        // Set lock=null and update lastSyncTime for this table on success
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: {
            lock: null,
            lastSyncTime: new Date(),
          },
        });

        WSLogger.debug({
          source: 'DownloadRecordsJob',
          message: 'Download completed for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
        });

        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            tableId: snapshotTable.id,
            source: 'agent',
          },
        });
      } catch (error) {
        // Mark table as failed
        currentTable.status = 'failed';

        // Checkpoint failed status for this table
        await checkpoint({
          publicProgress: {
            totalRecords,
            tables: tablesToProcess,
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
          source: 'DownloadRecordsJob',
          message: 'Failed to download records for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw exceptionForConnectorError(error, connector);
      }
    }
  }
}
