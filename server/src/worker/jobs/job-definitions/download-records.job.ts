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
import { WSLogger } from '../../../logger';

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
      include: { connectorAccount: true },
    });

    if (!snapshot) {
      throw new Error(`Snapshot with id ${data.snapshotId} not found`);
    }

    if (!snapshot.connectorAccount) {
      throw new Error(`Cannot download records for connectorless snapshot ${data.snapshotId}`);
    }

    const connectorAccount = await this.connectorAccountService.findOne(
      snapshot.connectorAccount.id,
      snapshot.connectorAccount.userId,
    );
    const connector = await this.connectorService.getConnector({
      service: snapshot.connectorAccount.service,
      connectorAccount,
      decryptedCredentials: connectorAccount,
    });

    const tableSpecs = snapshot.tableSpecs as AnyTableSpec[];

    type TableToProcess = {
      id: string;
      name: string;
      records: number;
      status: 'pending' | 'active' | 'completed' | 'failed';
    };

    // Create TableToProcess array for all table specs upfront
    const tablesToProcess: TableToProcess[] = tableSpecs.map((tableSpec) => ({
      id: tableSpec.id.wsId,
      name: tableSpec.name,
      records: 0,
      status: 'pending' as const,
    }));

    let totalRecords = 0;

    // Use index-based iteration
    for (let i = 0; i < tableSpecs.length; i++) {
      const tableSpec = tableSpecs[i];
      const currentTable = tablesToProcess[i];

      // Mark table as active
      currentTable.status = 'active';

      WSLogger.debug({
        source: 'SnapshotService',
        message: 'Downloading records',
        tableId: tableSpec.id.wsId,
        snapshotId: snapshot.id,
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
        await connector.downloadTableRecords(tableSpec, callback, connectorAccount, progress);
        // Mark table as completed
        currentTable.status = 'completed';
      } catch (error) {
        // Mark table as failed
        currentTable.status = 'failed';
        WSLogger.error({
          source: 'SnapshotService',
          message: 'Failed to download records for table',
          tableId: tableSpec.id.wsId,
          snapshotId: snapshot.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      }
    }
  }
}
