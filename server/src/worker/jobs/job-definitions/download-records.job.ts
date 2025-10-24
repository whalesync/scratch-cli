import type { PrismaClient } from '@prisma/client';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { ConnectorRecord } from '../../../remote-service/connectors/types';
import type { SnapshotDb } from '../../../snapshot/snapshot-db';
import type { SnapshotId } from '../../../types/ids';
import type { JsonSafeObject } from '../../../utils/objects';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { WSLogger } from '../../../logger';
import { SnapshotColumnContexts } from '../../../snapshot/types';

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
    snapshotId: string;
    snapshotTableIds?: string[]; // Optional: if provided, only download these tables
    userId: string;
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
    const snapshot = await this.prisma.snapshot.findUnique({
      where: { id: data.snapshotId },
      include: {
        connectorAccount: true,
        snapshotTables: {
          include: {
            connectorAccount: true,
          },
        },
      },
    });

    if (!snapshot) {
      throw new Error(`Snapshot with id ${data.snapshotId} not found`);
    }

    // Filter snapshot tables if specific tables are requested
    let snapshotTablesToProcess = snapshot.snapshotTables || [];
    if (data.snapshotTableIds && data.snapshotTableIds.length > 0) {
      snapshotTablesToProcess = snapshotTablesToProcess.filter((st) => data.snapshotTableIds!.includes(st.id));
      if (snapshotTablesToProcess.length === 0) {
        throw new Error(`No SnapshotTables found with the provided IDs in snapshot ${data.snapshotId}`);
      }
    }

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
        tableId: tableSpec.id.wsId,
        snapshotId: snapshot.id,
        snapshotTableId: snapshotTable.id,
      });

      // Get connector for this specific table
      const service = snapshotTable.connectorService;

      let decryptedConnectorAccount: Awaited<ReturnType<typeof this.connectorAccountService.findOne>> | null = null;
      if (snapshotTable.connectorAccountId) {
        decryptedConnectorAccount = await this.connectorAccountService.findOne(
          snapshotTable.connectorAccountId,
          data.userId,
        );
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
        await this.snapshotDb.upsertRecords(snapshot.id as SnapshotId, tableSpec, records);

        currentTable.records += records.length;
        totalRecords += records.length;

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
          (snapshotTable.columnContexts as SnapshotColumnContexts) || {},
          callback,
          progress,
        );
        // Mark table as completed
        currentTable.status = 'completed';
      } catch (error) {
        // Mark table as failed
        currentTable.status = 'failed';
        WSLogger.error({
          source: 'DownloadRecordsJob',
          message: 'Failed to download records for table',
          tableId: tableSpec.id.wsId,
          snapshotId: snapshot.id,
          snapshotTableId: snapshotTable.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw exceptionForConnectorError(error, connector);
      }
    }
  }
}
