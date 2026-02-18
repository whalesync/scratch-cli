import { Injectable } from '@nestjs/common';
import { Service, WorkbookId } from '@spinner/shared-types';
import { WSLogger } from 'src/logger';
import { CredentialEncryptionService } from '../credential-encryption/credential-encryption.service';
import { DbService } from '../db/db.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { BaseJsonTableSpec } from '../remote-service/connectors/types';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { EncryptedData } from '../utils/encryption';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';
import { PipelineSchemaService } from './pipeline-schema.service';
import { PipelinePhase, PublishPlanInfo } from './types';
import { parsePath } from './utils';

@Injectable()
export class PipelineRunService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
    private readonly fileIndexService: FileIndexService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly scratchGitService: ScratchGitService,
    private readonly schemaService: PipelineSchemaService,
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
          source: 'PipelineRunService.runPipeline',
          message: `Executing ${currentPhase} Phase: ${entries.length} entries`,
          workbookId: plan.workbookId,
          data: { pipelineId },
        });

        for (const entry of entries) {
          try {
            const tableSpec = await this.getTableSpecForEntry(plan.workbookId, entry.filePath, tableSpecCache);
            await this.dispatchEntry(currentPhase, entry, connector, tableSpec, plan.workbookId, plan.id);

            await this.db.client.publishPlanEntry.update({
              where: { id: entry.id },
              data: { status: 'success' },
            });
          } catch (err) {
            WSLogger.error({
              source: 'PipelineRunService.runPipeline',
              message: `Entry failed: ${entry.filePath}`,
              error: err,
              workbookId: plan.workbookId,
              data: { pipelineId, entryId: entry.id },
            });
            await this.db.client.publishPlanEntry.update({
              where: { id: entry.id },
              data: {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              },
            });
            throw err; // Fail fast for now
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
        source: 'PipelineRunService.runPipeline',
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
        source: 'PipelineRunService.runPipeline',
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
   * Get the BaseJsonTableSpec for a given entry by looking up the DataFolder.
   */
  private async getTableSpecForEntry(
    workbookId: string,
    filePath: string,
    cache: Map<string, BaseJsonTableSpec>,
  ): Promise<BaseJsonTableSpec> {
    // Extract folder path from file path (e.g. "articles/my-post.json" → "articles")
    const { folderPath } = parsePath(filePath);
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
   * Dispatch a single entry to the connector based on phase.
   */
  private async dispatchEntry(
    phase: string,
    entry: { filePath: string; operation: any; remoteRecordId?: string | null },
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    const operation = entry.operation as Record<string, unknown>;

    // Skip if no operation (except delete)
    if (phase !== 'delete' && !operation) {
      WSLogger.warn({
        source: 'PipelineRunService.dispatchEntry',
        message: `Skipping entry with no operation: ${entry.filePath}`,
        workbookId,
        data: { planId, entry },
      });
      return;
    }

    switch (phase) {
      case 'edit':
      case 'backfill':
        await this.dispatchEditOrBackfill(phase, { ...entry, operation }, connector, tableSpec, workbookId, planId);
        break;
      case 'create':
        await this.dispatchCreate(phase, { ...entry, operation }, connector, tableSpec, workbookId, planId);
        break;
      case 'delete':
        await this.dispatchDelete(entry, connector, tableSpec, workbookId);
        break;
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }

  private async dispatchEditOrBackfill(
    phase: string,
    entry: { filePath: string; operation: Record<string, unknown> },
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    // Resolve any remaining pseudo-references before sending
    const operation = await this.resolvePseudoRefs(workbookId, entry.operation);
    await connector.updateRecords(tableSpec, [operation]);

    // After edit/backfill: update reference index with new content
    await this.fileReferenceService.updateRefsForFiles(workbookId, 'main', [
      { path: entry.filePath, content: operation },
    ]);

    // Commit to main immediately
    await this.scratchGitService.commitFilesToBranch(
      workbookId as WorkbookId,
      'main',
      [{ path: entry.filePath, content: JSON.stringify(operation, null, 2) }],
      `Publish V2 ${phase}: ${entry.filePath}`,
    );

    // If this is the final operation for this file, also commit to dirty
    await this.commitToDirtyIfFinal(workbookId, planId, phase, entry.filePath, JSON.stringify(operation, null, 2));
  }

  private async dispatchCreate(
    phase: string,
    entry: { filePath: string; operation: Record<string, unknown> },
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
    planId: string,
  ): Promise<void> {
    // Strip temporary IDs before sending to connector
    const idField = tableSpec.idColumnRemoteId || 'id';
    const content = { ...entry.operation };
    const idValue = content[idField];
    if (typeof idValue === 'string' && idValue.startsWith('sppi_')) {
      delete content[idField];
    }
    const returned = await connector.createRecords(tableSpec, [content]);

    // After create: add file to FileIndex with the real ID
    if (returned[0]) {
      const realId = (returned[0] as Record<string, unknown>)[idField];
      if (realId && typeof realId === 'string') {
        const { folderPath, filename } = parsePath(entry.filePath);

        await this.fileIndexService.upsertBatch([
          {
            workbookId,
            folderPath,
            recordId: realId,
            filename,
          },
        ]);
        WSLogger.info({
          source: 'PipelineRunService.dispatchCreate',
          message: `Added to FileIndex: ${entry.filePath} -> ${realId}`,
          workbookId,
        });
      }
    }

    // Update reference index with new content (use returned data which has the real ID)
    const finalContent = returned[0] || entry.operation;
    await this.fileReferenceService.updateRefsForFiles(workbookId, 'main', [
      { path: entry.filePath, content: finalContent },
    ]);
    WSLogger.info({
      source: 'PipelineRunService.dispatchCreate',
      message: `Updated refs for created file: ${entry.filePath}`,
      workbookId,
    });

    // Commit to main immediately (with real ID)
    await this.scratchGitService.commitFilesToBranch(
      workbookId as WorkbookId,
      'main',
      [{ path: entry.filePath, content: JSON.stringify(finalContent, null, 2) }],
      `Publish V2 create: ${entry.filePath}`,
    );
    WSLogger.info({
      source: 'PipelineRunService.dispatchCreate',
      message: `Committed create to main: ${entry.filePath}`,
      workbookId,
    });

    // If this is the final operation for this file, also commit to dirty
    await this.commitToDirtyIfFinal(workbookId, planId, phase, entry.filePath, JSON.stringify(finalContent, null, 2));
  }

  private async dispatchDelete(
    entry: { filePath: string; remoteRecordId?: string | null },
    connector: Connector<Service, any>,
    tableSpec: BaseJsonTableSpec,
    workbookId: string,
  ): Promise<void> {
    const idField = tableSpec.idColumnRemoteId || 'id';
    const remoteId = entry.remoteRecordId;

    if (remoteId) {
      await connector.deleteRecords(tableSpec, [{ [idField]: remoteId }]);

      // After delete: remove refs where this file is the source
      await this.db.client.fileReference.deleteMany({
        where: { workbookId, sourceFilePath: entry.filePath },
      });
      WSLogger.info({
        source: 'PipelineRunService.dispatchDelete',
        message: `Deleted refs for file: ${entry.filePath}`,
        workbookId,
      });

      // Remove from FileIndex
      const { folderPath, filename } = parsePath(entry.filePath);
      await this.db.client.fileIndex.deleteMany({
        where: { workbookId, folderPath, filename },
      });
      WSLogger.info({
        source: 'PipelineRunService.dispatchDelete',
        message: `Removed from FileIndex: ${entry.filePath}`,
        workbookId,
      });

      // Delete from main immediately
      await this.scratchGitService.deleteFilesFromBranch(
        workbookId as WorkbookId,
        'main',
        [entry.filePath],
        `Publish V2 delete: ${entry.filePath}`,
      );
      WSLogger.info({
        source: 'PipelineRunService.dispatchDelete',
        message: `Deleted from main: ${entry.filePath}`,
        workbookId,
      });
    } else {
      WSLogger.warn({
        source: 'PipelineRunService.dispatchDelete',
        message: `Delete entry has no remoteRecordId: ${entry.filePath}`,
        workbookId,
      });
    }
  }

  /**
   * If this is the final operation for a file (no later phases pending),
   * commit the published content to dirty so it matches main.
   */
  private async commitToDirtyIfFinal(
    workbookId: string,
    planId: string,
    currentPhase: string,
    filePath: string,
    content: string,
  ): Promise<void> {
    // Backfill is always the last phase — always sync to dirty
    if (currentPhase === 'backfill') {
      await this.scratchGitService.commitFilesToBranch(
        workbookId as WorkbookId,
        'dirty',
        [{ path: filePath, content }],
        `Sync published content to dirty: ${filePath}`,
      );
      console.log(`[Run] Synced to dirty (backfill is final): ${filePath}`);
      return;
    }

    // For edit/create: check if a backfill entry exists for this file
    const laterPhases = currentPhase === 'edit' ? ['backfill'] : currentPhase === 'create' ? ['backfill'] : [];
    if (laterPhases.length === 0) return; // delete — file already gone from dirty

    const laterEntryCount = await this.db.client.publishPlanEntry.count({
      where: {
        planId,
        filePath,
        phase: { in: laterPhases },
        status: 'pending',
      },
    });

    if (laterEntryCount === 0) {
      // No backfill coming — this is the final content, sync to dirty
      await this.scratchGitService.commitFilesToBranch(
        workbookId as WorkbookId,
        'dirty',
        [{ path: filePath, content }],
        `Sync published content to dirty: ${filePath}`,
      );
      console.log(`[Run] Synced to dirty (final for file): ${filePath}`);
    } else {
      console.log(`[Run] Skipping dirty sync for ${filePath} — ${laterEntryCount} later entries pending`);
    }
  }
}
