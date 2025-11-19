import type { PrismaClient } from '@prisma/client';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { ConnectorRecord } from '../../../remote-service/connectors/types';
import type { WorkbookId } from '../../../types/ids';
import type { JsonSafeObject } from '../../../utils/objects';
import type { SnapshotDb } from '../../../workbook/snapshot-db';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { WSLogger } from '../../../logger';
import { SnapshotEventService } from '../../../workbook/snapshot-event.service';
import type { SnapshotColumnSettingsMap } from '../../../workbook/types';

export type DownloadRecordsPublicProgress = {
  totalRecords: number;
  tables: {
    id: string;
    name: string;
    records: number;
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
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
  ) {}

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

    // Set syncInProgress=true for all tables being processed
    await this.prisma.snapshotTable.updateMany({
      where: {
        id: { in: snapshotTablesToProcess.map((st) => st.id) },
      },
      data: {
        syncInProgress: true,
      },
    });

    WSLogger.debug({
      source: 'DownloadRecordsJob',
      message: 'Set syncInProgress=true for tables',
      workbookId: workbook.id,
      tableCount: snapshotTablesToProcess.length,
    });

    type TableToProcess = {
      id: string;
      name: string;
      records: number;
      status: 'pending' | 'active' | 'completed' | 'failed';
    };

    // Create TableToProcess array for snapshot tables to process
    const tablesToProcess: TableToProcess[] = snapshotTablesToProcess.map((snapshotTable) => ({
      id: (snapshotTable.tableSpec as AnyTableSpec).id.wsId,
      name: (snapshotTable.tableSpec as AnyTableSpec).name,
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

      WSLogger.debug({
        source: 'DownloadRecordsJob',
        message: 'Downloading records for table',
        workbookId: workbook.id,
        snapshotTableId: snapshotTable.id,
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
        service,
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

        // Set syncInProgress=false and update lastSyncTime for this table on success
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: {
            syncInProgress: false,
            lastSyncTime: new Date(),
          },
        });

        WSLogger.debug({
          source: 'DownloadRecordsJob',
          message: 'Download completed for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
        });
      } catch (error) {
        // Mark table as failed
        currentTable.status = 'failed';

        // Set syncInProgress=false for this table on failure
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: { syncInProgress: false },
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
