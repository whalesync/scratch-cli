import { Injectable } from '@nestjs/common';
import { Service, WorkbookId } from '@spinner/shared-types';
import { WSLogger } from 'src/logger';
import { ParsedContent } from 'src/utils/objects';
import { CredentialEncryptionService } from '../credential-encryption/credential-encryption.service';
import { DbService } from '../db/db.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { BaseJsonTableSpec, ConnectorFile } from '../remote-service/connectors/types';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { EncryptedData } from '../utils/encryption';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';
import { PublishSchemaService } from './publish-schema.service';
import { PipelinePhase, PublishPlanInfo } from './types';
import { parsePath } from './utils';

type PublishEntry = {
  id: string;
  filePath: string;
  operation: any;
  remoteRecordId?: string | null;
  dataFolderId?: string | null;
};

@Injectable()
export class PublishRunService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
    private readonly fileIndexService: FileIndexService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly scratchGitService: ScratchGitService,
    private readonly schemaService: PublishSchemaService,
  ) {}

  async runPipeline(pipelineId: string, phase?: string): Promise<PublishPlanInfo> {
    const plan = await this.db.client.publishPlan.findUnique({ where: { id: pipelineId } });
    if (!plan) {
      throw new Error('Pipeline plan not found');
    }

    // Resolve connector
    const connector = await this.resolveConnector(plan.connectorAccountId);

    // Cache tableSpecs per folder to avoid repeated DB lookups
    const tableSpecCache = new Map<string, BaseJsonTableSpec>();
    // Cache tableSpecs per dataFolderId
    const dataFolderSpecCache = new Map<string, BaseJsonTableSpec | null>();

    try {
      const allPhases = ['edit', 'create', 'delete', 'backfill'] as const;
      const phasesToRun = phase ? [phase] : [...allPhases];

      for (const currentPhase of phasesToRun) {
        // Set status to {phase}s-running (e.g. "edits-running", "creates-running")
        const phasePrefix = currentPhase + 's';
        await this.db.client.publishPlan.update({
          where: { id: pipelineId },
          data: { status: `${phasePrefix}-running` },
        });

        // Fetch pending entries for this phase
        const entries = await this.db.client.publishPlanEntry.findMany({
          where: { planId: pipelineId, phase: currentPhase, status: 'pending' },
        });

        WSLogger.info({
          source: 'PublishRunService.runPipeline',
          message: `Executing ${currentPhase} Phase: ${entries.length} entries`,
          workbookId: plan.workbookId,
          data: { pipelineId },
        });

        // Fetch distinct tables (by dataFolderId) that have pending entries
        const distinctFolders = await this.db.client.publishPlanEntry.findMany({
          where: { planId: pipelineId, phase: currentPhase, status: 'pending' },
          select: { dataFolderId: true },
          distinct: ['dataFolderId'],
        });

        WSLogger.info({
          source: 'PublishRunService.runPipeline',
          message: `Found ${distinctFolders.length} distinct folders/tables to process in ${currentPhase} phase`,
          workbookId: plan.workbookId,
          data: { pipelineId, folders: distinctFolders.map((t) => t.dataFolderId) },
        });

        for (const { dataFolderId } of distinctFolders) {
          if (!dataFolderId) continue;

          // Fetch all entries for this table
          const entries = await this.db.client.publishPlanEntry.findMany({
            where: {
              planId: pipelineId,
              phase: currentPhase,
              status: 'pending',
              dataFolderId,
            },
            orderBy: { id: 'asc' }, // Ensure deterministic order
          });

          if (entries.length === 0) continue;

          // Resolve table spec
          const tableSpec = await this.schemaService.getTableSpecById(dataFolderId, dataFolderSpecCache);
          if (!tableSpec) {
            WSLogger.warn({
              source: 'PublishRunService.runPipeline',
              message: `Could not find spec for dataFolderId: ${dataFolderId}`,
              workbookId: plan.workbookId,
            });
            // Mark entries as failed?
            continue;
          }

          // Determine batch size
          const batchSize = connector.getBatchSize(
            currentPhase === 'delete' ? 'delete' : currentPhase === 'create' ? 'create' : 'update',
          );

          WSLogger.info({
            source: 'PublishRunService.runPipeline',
            message: `Processing table for folder ${dataFolderId} (${entries.length} entries)`,
            workbookId: plan.workbookId,
            data: { pipelineId, tableSpecName: tableSpec.name, batchSize },
          });

          // Chunk entries
          for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            await this.processBatch(currentPhase, batch, connector, tableSpec, plan.workbookId, plan.id);
          }
        }

        // --- RETRY LOGIC ---
        // Fetch failed-batch entries for this phase (across all tables)
        const failedEntries = await this.db.client.publishPlanEntry.findMany({
          where: { planId: pipelineId, phase: currentPhase, status: 'failed-batch' },
        });

        if (failedEntries.length > 0) {
          WSLogger.warn({
            source: 'PublishRunService.runPipeline',
            message: `Retrying ${failedEntries.length} failed-batch entries individually`,
            workbookId: plan.workbookId,
            data: { pipelineId },
          });

          // Group failed entries by table again for spec resolution (or just resolve one by one)
          // Resolving one by one is safer but slower.
          // We can reuse the same table-based iteration logic or just cache specs.
          // Let's iterate individually but verify spec from cache.

          for (const entry of failedEntries) {
            let tableSpec: BaseJsonTableSpec | null = null;
            if (entry.dataFolderId) {
              tableSpec = await this.schemaService.getTableSpecById(entry.dataFolderId, dataFolderSpecCache);
            }
            if (!tableSpec) {
              // Fallback to path lookup if dataFolderId missing (old entries?)
              const { folderPath } = parsePath(entry.filePath);
              tableSpec = await this.getTableSpecForFolder(plan.workbookId, folderPath, tableSpecCache);
            }

            // Process individually (batch size 1)
            await this.processBatch(currentPhase, [entry], connector, tableSpec, plan.workbookId, plan.id);
          }
        }

        // Set completed status: backfill-completed → "completed", others → "{phase}s-completed"
        const completedStatus = currentPhase === 'backfill' && !phase ? 'completed' : `${phasePrefix}-completed`;
        await this.db.client.publishPlan.update({
          where: { id: pipelineId },
          data: { status: completedStatus },
        });
      }

      const finalStatus = phase ? `${phase}s-completed` : 'completed';

      // Rebase dirty on top of main so published changes disappear from dirty
      WSLogger.info({
        source: 'PublishRunService.runPipeline',
        message: 'Rebasing dirty on main',
        workbookId: plan.workbookId,
      });
      await this.scratchGitService.rebaseDirty(plan.workbookId as WorkbookId);

      return {
        pipelineId: plan.id,
        workbookId: plan.workbookId,
        userId: plan.userId,
        phases: plan.phases as never as PipelinePhase[],
        branchName: plan.branchName,
        createdAt: plan.createdAt,
        status: finalStatus,
      };
    } catch (err) {
      WSLogger.error({
        source: 'PublishRunService.runPipeline',
        message: 'Pipeline failed',
        error: err,
        data: { pipelineId },
      });
      await this.db.client.publishPlan.update({
        where: { id: pipelineId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  /**
   * Resolve the connector instance for the given connector account.
   */
  private async resolveConnector(connectorAccountId: string | null): Promise<Connector<Service, any>> {
    if (!connectorAccountId) {
      throw new Error('No connectorAccountId on plan — cannot resolve connector');
    }

    const account = await this.db.client.connectorAccount.findUnique({
      where: { id: connectorAccountId },
    });
    if (!account) {
      throw new Error(`ConnectorAccount not found: ${connectorAccountId}`);
    }

    const decryptedCredentials = await this.credentialEncryptionService.decryptCredentials(
      account.encryptedCredentials as unknown as EncryptedData,
    );

    return this.connectorsService.getConnector({
      service: account.service as Service,
      connectorAccount: account,
      decryptedCredentials,
    });
  }

  /**
   * Get the BaseJsonTableSpec for a given folder.
   */
  private async getTableSpecForFolder(
    workbookId: string,
    folderPath: string,
    cache: Map<string, BaseJsonTableSpec>,
  ): Promise<BaseJsonTableSpec> {
    const spec = await this.schemaService.getTableSpec(workbookId, folderPath, cache);
    if (!spec) {
      return { name: 'unknown', schema: {} } as BaseJsonTableSpec;
    }
    return spec;
  }

  /**
   * Resolve pseudo-references (@/path/file.json) in a JSON operation to real record IDs.
   * Walks all string values in the object recursively.
   */
  private async resolvePseudoRefs(workbookId: string, obj: Record<string, unknown>): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('@/')) {
        // Resolve pseudo-reference to real ID
        const targetPath = value.substring(2); // Strip "@/"
        const { folderPath: folder, filename } = parsePath(targetPath);

        const recordId = await this.fileIndexService.getRecordId(workbookId, folder, filename);
        if (!recordId) {
          throw new Error(
            `Cannot resolve pseudo-ref "${value}": no record ID found in FileIndex for folder="${folder}" file="${filename}"`,
          );
        }
        // Debug only
        // console.log(`[Run] Resolved pseudo-ref "${value}" → "${recordId}"`);
        result[key] = recordId;
      } else if (Array.isArray(value)) {
        // Recurse into arrays
        const resolved: unknown[] = [];
        for (const item of value) {
          if (typeof item === 'string' && item.startsWith('@/')) {
            const targetPath = item.substring(2);
            const { folderPath: folder, filename } = parsePath(targetPath);
            const recordId = await this.fileIndexService.getRecordId(workbookId, folder, filename);

            if (!recordId) {
              throw new Error(
                `Cannot resolve pseudo-ref "${item}": no record ID found in FileIndex for folder="${folder}" file="${filename}"`,
              );
            }
            resolved.push(recordId);
          } else if (typeof item === 'object' && item !== null) {
            resolved.push(await this.resolvePseudoRefs(workbookId, item as Record<string, unknown>));
          } else {
            resolved.push(item);
          }
        }
        result[key] = resolved;
      } else if (typeof value === 'object' && value !== null) {
        // Recurse into nested objects
        result[key] = await this.resolvePseudoRefs(workbookId, value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Process a batch of entries for a single table.
   * If successful, upgrades status to 'success'.
   * If failed, marks all as 'failed-batch' for later individual retry.
   */
  private async processBatch(
    phase: string,
    entries: PublishEntry[], // Type explicitly if possible, but 'any' avoids circular dep issues for now
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    try {
      switch (phase) {
        case 'edit':
        case 'backfill':
          await this.dispatchUpdateBatch(phase, entries, connector, tableSpec, workbookId, planId);
          break;
        case 'create':
          await this.dispatchCreateBatch(phase, entries, connector, tableSpec, workbookId, planId);
          break;
        case 'delete':
          await this.dispatchDeleteBatch(entries, connector, tableSpec, workbookId, planId);
          break;
        default:
          throw new Error(`Unknown phase: ${phase}`);
      }

      // success
      await this.db.client.publishPlanEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { status: 'success', error: null },
      });
    } catch (err) {
      WSLogger.warn({
        source: 'PublishRunService.processBatch',
        message: `Batch failed (size=${entries.length})`,
        error: err,
        workbookId,
        data: { planId, phase, entryIds: entries.map((e) => e.id) },
      });

      // failed-batch
      await this.db.client.publishPlanEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: {
          status: 'failed-batch',
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  private async dispatchUpdateBatch(
    phase: string,
    entries: PublishEntry[],
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    const operations: ParsedContent[] = [];
    const entriesWithOps: { entry: PublishEntry; resolvedOp: ParsedContent }[] = [];

    for (const entry of entries) {
      if (!entry.operation) continue;
      // Resolve pseudo-refs
      const resolvedOp = (await this.resolvePseudoRefs(
        workbookId,
        entry.operation as Record<string, unknown>,
      )) as ParsedContent;
      operations.push(resolvedOp);
      entriesWithOps.push({ entry, resolvedOp });
    }

    if (operations.length === 0) return;

    // Bulk update
    await connector.updateRecords(tableSpec, operations);

    // Update Refs & Git
    // We can do this in parallel or sequentially. Sequential for safety.
    const refUpdates = entriesWithOps.map(({ entry, resolvedOp }) => ({
      path: entry.filePath,
      content: resolvedOp,
    }));

    await this.fileReferenceService.updateRefsForFiles(workbookId, 'main', refUpdates);

    // Git Commit (Main)
    const gitFiles = refUpdates.map((u) => ({ path: u.path, content: JSON.stringify(u.content, null, 2) }));
    await this.scratchGitService.commitFilesToBranch(
      workbookId as WorkbookId,
      'main',
      gitFiles,
      `Publish V2 ${phase} batch (${entries.length})`,
    );

    // Git Commit (Dirty) - checking if final
    const dirtySyncBatch = entriesWithOps.map(({ entry, resolvedOp }) => ({
      filePath: entry.filePath,
      content: JSON.stringify(resolvedOp, null, 2),
    }));
    await this.syncBatchToDirtyIfFinal(workbookId, planId, phase, dirtySyncBatch);
  }

  private async dispatchCreateBatch(
    phase: string,
    entries: PublishEntry[],
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    const operations: any[] = [];
    const entriesWithOps: { entry: PublishEntry; resolvedOp: ParsedContent }[] = [];
    const idField = tableSpec.idColumnRemoteId || 'id';

    for (const entry of entries) {
      if (!entry.operation) continue;
      const content = { ...(entry.operation as Record<string, unknown>) };

      // Strip temporary ID
      const idValue = content[idField];
      if (typeof idValue === 'string' && idValue.startsWith('sppi_')) {
        delete content[idField];
      }

      // Resolve pseudo-refs (if any - create usually doesn't have them yet, but back references might?)
      // Assuming create operations might have pseudo-refs to *other* already created records?
      // Yes, safe to resolve.
      const resolvedOp = await this.resolvePseudoRefs(workbookId, content);

      operations.push(resolvedOp);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      entriesWithOps.push({ entry, resolvedOp: resolvedOp as any });
    }

    if (operations.length === 0) return;

    // Bulk create
    const returnedRecords = await connector.createRecords(tableSpec, operations as ConnectorFile[]);

    // Post-process
    const fileIndexUpdates: { workbookId: string; folderPath: string; filename: string; recordId: string }[] = [];
    const refUpdates: { path: string; content: any }[] = [];
    const gitFiles: { path: string; content: string }[] = [];

    for (let i = 0; i < entriesWithOps.length; i++) {
      const { entry, resolvedOp } = entriesWithOps[i];
      const returned = returnedRecords[i] || resolvedOp; // Fallback if connector doesn't return

      // Update File Index
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const realId = (returned as any)[idField];
      if (realId && typeof realId === 'string') {
        const { folderPath, filename } = parsePath(entry.filePath);
        fileIndexUpdates.push({
          workbookId,
          folderPath,
          filename,
          recordId: realId,
        });
      }

      // Update Refs
      refUpdates.push({ path: entry.filePath, content: returned });

      // Git
      gitFiles.push({ path: entry.filePath, content: JSON.stringify(returned, null, 2) });
    }

    if (fileIndexUpdates.length > 0) {
      await this.fileIndexService.upsertBatch(fileIndexUpdates);
    }

    await this.fileReferenceService.updateRefsForFiles(workbookId, 'main', refUpdates);

    await this.scratchGitService.commitFilesToBranch(
      workbookId as WorkbookId,
      'main',
      gitFiles,
      `Publish V2 create batch (${entries.length})`,
    );

    // Dirty sync
    const dirtySyncBatch = entriesWithOps.map(({ entry, resolvedOp }, i) => {
      const returned = returnedRecords[i] || resolvedOp;
      return {
        filePath: entry.filePath,
        content: JSON.stringify(returned, null, 2),
      };
    });
    await this.syncBatchToDirtyIfFinal(workbookId, planId, phase, dirtySyncBatch);
  }

  private async dispatchDeleteBatch(
    entries: PublishEntry[],
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    const idField = tableSpec.idColumnRemoteId || 'id';
    const filters: { [key: string]: string }[] = [];
    const validEntries: PublishEntry[] = [];

    for (const entry of entries) {
      if (entry.remoteRecordId) {
        filters.push({ [idField]: entry.remoteRecordId });
        validEntries.push(entry);
      }
    }

    if (filters.length === 0) return;

    // Bulk delete
    await connector.deleteRecords(tableSpec, filters);

    // Cleanup local state
    const filesToDelete = validEntries.map((e) => e.filePath);

    // 1. Refs
    await this.db.client.fileReference.deleteMany({
      where: { workbookId, sourceFilePath: { in: filesToDelete } },
    });

    // 2. Index
    // Need to parse paths.
    // Optimization: delete many by folder/filename or just by iterate?
    // DeleteMany with OR conditions is okay.
    const fileIndexDeletes = validEntries.map((e) => {
      const { folderPath, filename } = parsePath(e.filePath);
      return { folderPath, filename };
    });

    // We can't do deleteMany with (folder, filename) pairs easily in Prisma without OR
    // Loop is fine for local DB cleanup (fast)
    for (const { folderPath, filename } of fileIndexDeletes) {
      await this.db.client.fileIndex.deleteMany({
        where: { workbookId, folderPath, filename },
      });
    }

    // 3. Git
    await this.scratchGitService.deleteFilesFromBranch(
      workbookId as WorkbookId,
      'main',
      filesToDelete,
      `Publish V2 delete batch (${filesToDelete.length})`,
    );

    // Dirty sync
    const dirtySyncBatch = validEntries.map((entry) => ({
      filePath: entry.filePath,
      content: null,
    }));
    await this.syncBatchToDirtyIfFinal(workbookId, planId, 'delete', dirtySyncBatch);
  }

  /**
   * Identifies which files in the batch are going through their final operation
   * (no later phases pending), and syncs them to the dirty branch.
   * If content is null, it means the file was deleted.
   */
  private async syncBatchToDirtyIfFinal(
    workbookId: string,
    planId: string,
    currentPhase: string,
    items: { filePath: string; content: string | null }[],
  ): Promise<void> {
    if (items.length === 0) return;

    const finalDeletes: string[] = [];
    const finalCommits: { path: string; content: string }[] = [];

    // Backfill and delete are always the last phase for a record — always sync to dirty
    if (currentPhase === 'backfill' || currentPhase === 'delete') {
      for (const item of items) {
        if (item.content === null) {
          finalDeletes.push(item.filePath);
        } else {
          finalCommits.push({ path: item.filePath, content: item.content });
        }
      }
    } else {
      // For edit/create: we must check if a backfill entry exists for these files
      const filePaths = items.map((i) => i.filePath);

      // Find all later pending phases for any of these files
      const laterEntries = await this.db.client.publishPlanEntry.groupBy({
        by: ['filePath'],
        where: {
          planId,
          filePath: { in: filePaths },
          phase: 'backfill',
          status: 'pending',
        },
        _count: true,
      });

      // Map of filePath -> count of later pending entries
      const pendingMap = new Map(laterEntries.map((g) => [g.filePath, g._count]));

      for (const item of items) {
        if (!pendingMap.has(item.filePath)) {
          // No backfill coming — this is the final content, sync to dirty
          if (item.content === null) {
            finalDeletes.push(item.filePath);
          } else {
            finalCommits.push({ path: item.filePath, content: item.content });
          }
        }
      }
    }

    // Execute batch writes
    if (finalDeletes.length > 0) {
      await this.scratchGitService.deleteFilesFromBranch(
        workbookId as WorkbookId,
        'dirty',
        finalDeletes,
        `Sync published deletes to dirty (${finalDeletes.length})`,
      );
    }

    if (finalCommits.length > 0) {
      await this.scratchGitService.commitFilesToBranch(
        workbookId as WorkbookId,
        'dirty',
        finalCommits,
        `Sync published content to dirty (${finalCommits.length})`,
      );
    }
  }
}
