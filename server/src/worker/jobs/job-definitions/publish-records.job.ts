import type { PrismaClient } from '@prisma/client';
import { InputJsonObject } from '@prisma/client/runtime/library';
import { type WorkbookId, createActionId } from '@spinner/shared-types';
import type { ConnectorsService } from '../../../remote-service/connectors/connectors.service';
import type { AnyTableSpec } from '../../../remote-service/connectors/library/custom-spec-registry';
import type { JsonSafeObject } from '../../../utils/objects';
import type { JobDefinitionBuilder, JobHandlerBuilder, Progress } from '../base-types';
// Non type imports
import { ConnectorAccountService } from 'src/remote-service/connector-account/connector-account.service';
import { exceptionForConnectorError } from 'src/remote-service/connectors/error';
import { Actor } from 'src/users/types';
import { WSLogger } from '../../../logger';
import { SnapshotEventService } from '../../../workbook/snapshot-event.service';
import { WorkbookService } from '../../../workbook/workbook.service';

export type PublishRecordsPublicProgress = {
  totalRecordsPublished: number;
  tables: {
    id: string;
    name: string;
    connector: string;
    creates: number;
    updates: number;
    deletes: number;
    expectedCreates: number;
    expectedUpdates: number;
    expectedDeletes: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
  }[];
};

export type PublishRecordsJobDefinition = JobDefinitionBuilder<
  'publish-records',
  {
    workbookId: WorkbookId;
    snapshotTableIds?: string[]; // Optional: if provided, only publish these tables
    userId: string;
    organizationId: string;
    progress?: JsonSafeObject;
    initialPublicProgress?: PublishRecordsPublicProgress;
  },
  PublishRecordsPublicProgress,
  { tableIndex: number },
  void
>;

export class PublishRecordsJobHandler implements JobHandlerBuilder<PublishRecordsJobDefinition> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly connectorService: ConnectorsService,
    private readonly connectorAccountService: ConnectorAccountService,
    private readonly snapshotEventService: SnapshotEventService,
    private readonly workbookService: WorkbookService,
  ) {}

  async run(params: {
    data: PublishRecordsJobDefinition['data'];
    progress: Progress<
      PublishRecordsJobDefinition['publicProgress'],
      PublishRecordsJobDefinition['initialJobProgress']
    >;
    abortSignal: AbortSignal;
    checkpoint: (
      progress: Omit<
        Progress<PublishRecordsJobDefinition['publicProgress'], PublishRecordsJobDefinition['initialJobProgress']>,
        'timestamp'
      >,
    ) => Promise<void>;
  }) {
    const { data, checkpoint, progress } = params;

    // Fetch workbook with snapshot tables
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
    //     lock: 'publish',
    //   },
    // });

    this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
      type: 'sync-status-changed',
      data: {
        source: 'user',
        message: 'Publish records job started',
      },
    });

    WSLogger.debug({
      source: 'PublishRecordsJob',
      message: 'Set lock=publish for tables',
      workbookId: workbook.id,
      tableCount: snapshotTablesToProcess.length,
    });

    type TableToProcess = {
      id: string;
      name: string;
      connector: string;
      creates: number;
      updates: number;
      deletes: number;
      expectedCreates: number;
      expectedUpdates: number;
      expectedDeletes: number;
      status: 'pending' | 'in_progress' | 'completed' | 'failed';
    };

    // Create a map for quick lookup of initial progress
    const initialProgressMap = new Map(data.initialPublicProgress?.tables.map((t) => [t.id, t]) || []);

    // Create TableToProcess array for snapshot tables to process
    const tablesToProcess: TableToProcess[] = snapshotTablesToProcess.map((snapshotTable) => {
      const tableId = (snapshotTable.tableSpec as AnyTableSpec).id.wsId;
      const initialTableProgress = initialProgressMap.get(tableId);

      return {
        id: tableId,
        name: (snapshotTable.tableSpec as AnyTableSpec).name,
        connector: snapshotTable.connectorService,
        creates: 0,
        updates: 0,
        deletes: 0,
        expectedCreates: initialTableProgress?.expectedCreates || 0,
        expectedUpdates: initialTableProgress?.expectedUpdates || 0,
        expectedDeletes: initialTableProgress?.expectedDeletes || 0,
        status: 'pending' as const,
      };
    });

    let totalRecordsPublished = 0;

    // Determine starting index from progress (for resumability)
    const startIndex = progress?.jobProgress?.tableIndex ?? 0;

    WSLogger.debug({
      source: 'PublishRecordsJob',
      message: 'Starting publish job',
      workbookId: workbook.id,
      tableCount: snapshotTablesToProcess.length,
      startIndex,
    });

    // Process each snapshot table with its own connector (per-table phases)
    for (let i = startIndex; i < snapshotTablesToProcess.length; i++) {
      const snapshotTable = snapshotTablesToProcess[i];
      const tableSpec = snapshotTable.tableSpec as AnyTableSpec;
      const currentTable = tablesToProcess[i];

      // Mark table as in_progress
      currentTable.status = 'in_progress';

      // Checkpoint initial status for this table
      await checkpoint({
        publicProgress: {
          totalRecordsPublished,
          tables: tablesToProcess,
        },
        jobProgress: {
          tableIndex: i,
        },
        connectorProgress: {},
      });

      WSLogger.debug({
        source: 'PublishRecordsJob',
        message: 'Publishing records for table',
        workbookId: workbook.id,
        snapshotTableId: snapshotTable.id,
        tableIndex: i,
      });

      // Get connector for this specific table
      const service = snapshotTable.connectorService;

      let decryptedConnectorAccount: Awaited<ReturnType<typeof this.connectorAccountService.findOne>> | null = null;
      if (snapshotTable.connectorAccountId) {
        const actor: Actor = {
          userId: data.userId,
          organizationId: data.organizationId,
        };
        decryptedConnectorAccount = await this.connectorAccountService.findOne(snapshotTable.connectorAccountId, actor);
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

      try {
        // Phase 1: Process creates for this table
        WSLogger.debug({
          source: 'PublishRecordsJob',
          message: 'Publishing creates for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
        });

        await this.workbookService.publishCreatesToTableWithProgress(
          workbook,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          connector,
          snapshotTable,
          tableSpec,
          async (count: number) => {
            currentTable.creates += count;
            totalRecordsPublished += count;

            // Send real-time event
            this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
              type: 'snapshot-updated',
              data: {
                tableId: snapshotTable.id,
                source: 'user',
                message: 'Updating publishing counts for creates',
              },
            });

            // Checkpoint after each batch
            await checkpoint({
              publicProgress: {
                totalRecordsPublished,
                tables: tablesToProcess,
              },
              jobProgress: {
                tableIndex: i,
              },
              connectorProgress: {},
            });
          },
        );

        // Phase 2: Process updates for this table
        WSLogger.debug({
          source: 'PublishRecordsJob',
          message: 'Publishing updates for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
        });

        await this.workbookService.publishUpdatesToTableWithProgress(
          workbook,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          connector,
          snapshotTable,
          tableSpec,
          async (count: number) => {
            currentTable.updates += count;
            totalRecordsPublished += count;

            // Send real-time event
            this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
              type: 'snapshot-updated',
              data: {
                tableId: snapshotTable.id,
                source: 'user',
                message: 'Updating publishing counts for updates',
              },
            });

            // Checkpoint after each batch
            await checkpoint({
              publicProgress: {
                totalRecordsPublished,
                tables: tablesToProcess,
              },
              jobProgress: {
                tableIndex: i,
              },
              connectorProgress: {},
            });
          },
        );

        // Phase 3: Process deletes for this table
        WSLogger.debug({
          source: 'PublishRecordsJob',
          message: 'Publishing deletes for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
        });

        await this.workbookService.publishDeletesToTableWithProgress(
          workbook,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          connector,
          snapshotTable,
          tableSpec,
          async (count: number) => {
            currentTable.deletes += count;
            totalRecordsPublished += count;

            // Send real-time event
            this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
              type: 'snapshot-updated',
              data: {
                tableId: snapshotTable.id,
                source: 'user',
                message: 'Updating publishing counts for deletes',
              },
            });

            // Checkpoint after each batch
            await checkpoint({
              publicProgress: {
                totalRecordsPublished,
                tables: tablesToProcess,
              },
              jobProgress: {
                tableIndex: i,
              },
              connectorProgress: {},
            });
          },
        );

        // Mark table as completed
        currentTable.status = 'completed';

        // Checkpoint final status for this table
        await checkpoint({
          publicProgress: {
            totalRecordsPublished,
            tables: tablesToProcess,
          },
          jobProgress: {
            tableIndex: i + 1,
          },
          connectorProgress: {},
        });

        // Set lock=null and dirty=false for this table on success
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: {
            lock: null,
            dirty: false,
          },
        });

        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'snapshot-updated',
          data: {
            source: 'user',
            tableId: snapshotTable.id,
            message: 'Publish records job completed for table',
          },
        });

        WSLogger.debug({
          source: 'PublishRecordsJob',
          message: 'Publish completed for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
          creates: currentTable.creates,
          updates: currentTable.updates,
          deletes: currentTable.deletes,
        });
      } catch (error) {
        // Mark table as failed
        currentTable.status = 'failed';

        // Set lock=null for this table on failure
        await this.prisma.snapshotTable.update({
          where: { id: snapshotTable.id },
          data: { lock: null },
        });

        this.snapshotEventService.sendSnapshotEvent(workbook.id as WorkbookId, {
          type: 'sync-status-changed',
          data: {
            source: 'user',
            tableId: snapshotTable.id,
            message: 'Publish records job failed for table',
          },
        });

        WSLogger.error({
          source: 'PublishRecordsJob',
          message: 'Failed to publish records for table',
          workbookId: workbook.id,
          snapshotTableId: snapshotTable.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Stop immediately on error (as per design decision #3)
        throw exceptionForConnectorError(error, connector);
      }
    }

    WSLogger.debug({
      source: 'PublishRecordsJob',
      message: 'Publish job completed',
      workbookId: workbook.id,
      totalRecordsPublished,
    });

    // If we fail for some reason we don't want to block the job from completing.
    try {
      // Track the publish creates, updates, and deletes for historical info
      const totalCreates = tablesToProcess.reduce((sum, table) => sum + table.creates, 0);
      const totalUpdates = tablesToProcess.reduce((sum, table) => sum + table.updates, 0);
      const totalDeletes = tablesToProcess.reduce((sum, table) => sum + table.deletes, 0);
      const metadata: InputJsonObject = {
        workbookId: data.workbookId,
        snapshotTableIds: data.snapshotTableIds ?? [],
        creates: totalCreates,
        updates: totalUpdates,
        deletes: totalDeletes,
      };
      // track the publish action for billing purposes
      await this.prisma.action.create({
        data: {
          id: createActionId(),
          organizationId: data.organizationId,
          userId: data.userId,
          actionType: 'PUBLISH',
          metadata,
        },
      });
    } catch (error) {
      // Log error but don't fail the job if action tracking fails
      WSLogger.error({
        source: 'PublishRecordsJob',
        message: 'Failed to track action for publish',
        workbookId: workbook.id,
        organizationId: data.organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
