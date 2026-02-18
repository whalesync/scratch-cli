import { Injectable } from '@nestjs/common';
import { Service, WorkbookId } from '@spinner/shared-types';
import { CredentialEncryptionService } from '../credential-encryption/credential-encryption.service';
import { DbService } from '../db/db.service';
import { Connector } from '../remote-service/connectors/connector';
import { ConnectorsService } from '../remote-service/connectors/connectors.service';
import { BaseJsonTableSpec } from '../remote-service/connectors/types';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { EncryptedData } from '../utils/encryption';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';
import { PipelineInfo, PipelinePhase } from './types';

@Injectable()
export class PipelineRunService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
    private readonly credentialEncryptionService: CredentialEncryptionService,
    private readonly fileIndexService: FileIndexService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly scratchGitService: ScratchGitService,
  ) {}

  async runPipeline(pipelineId: string, phase?: string): Promise<PipelineInfo> {
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

        console.log(`[Run] Executing ${currentPhase} Phase: ${entries.length} entries`);

        for (const entry of entries) {
          try {
            const tableSpec = await this.getTableSpecForEntry(plan.workbookId, entry.filePath, tableSpecCache);
            await this.dispatchEntry(currentPhase, entry, connector, tableSpec, plan.workbookId, plan.id);

            await this.db.client.publishPlanEntry.update({
              where: { id: entry.id },
              data: { status: 'success' },
            });
          } catch (err) {
            console.error(`[Run] Entry failed: ${entry.filePath}`, err);
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
      console.log(`[Run] Rebasing dirty on main...`);
      await this.scratchGitService.rebaseDirty(plan.workbookId as WorkbookId);
      console.log(`[Run] Rebase complete.`);

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
      console.error('Pipeline failed', err);
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
    const lastSlash = filePath.lastIndexOf('/');
    const folderPath = lastSlash === -1 ? '' : filePath.substring(0, lastSlash);

    if (cache.has(folderPath)) {
      return cache.get(folderPath)!;
    }

    // Look up the DataFolder by path (try with and without leading slash)
    const dataFolder = await this.db.client.dataFolder.findFirst({
      where: {
        workbookId,
        path: { in: [folderPath, `/${folderPath}`] },
      },
    });

    if (!dataFolder?.schema) {
      throw new Error(`No schema found for folder: ${folderPath}`);
    }

    const tableSpec = dataFolder.schema as unknown as BaseJsonTableSpec;
    cache.set(folderPath, tableSpec);
    return tableSpec;
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
        const lastSlash = targetPath.lastIndexOf('/');
        const folder = lastSlash === -1 ? '' : targetPath.substring(0, lastSlash);
        const filename = targetPath.substring(lastSlash + 1);

        const recordId = await this.fileIndexService.getRecordId(workbookId, folder, filename);
        if (!recordId) {
          throw new Error(
            `Cannot resolve pseudo-ref "${value}": no record ID found in FileIndex for folder="${folder}" file="${filename}"`,
          );
        }
        console.log(`[Run] Resolved pseudo-ref "${value}" → "${recordId}"`);
        result[key] = recordId;
      } else if (Array.isArray(value)) {
        // Recurse into arrays
        const resolved: unknown[] = [];
        for (const item of value) {
          if (typeof item === 'string' && item.startsWith('@/')) {
            const targetPath = item.substring(2);
            const lastSlash = targetPath.lastIndexOf('/');
            const folder = lastSlash === -1 ? '' : targetPath.substring(0, lastSlash);
            const filename = targetPath.substring(lastSlash + 1);
            const recordId = await this.fileIndexService.getRecordId(workbookId, folder, filename);
            if (!recordId) {
              throw new Error(
                `Cannot resolve pseudo-ref "${item}": no record ID found in FileIndex for folder="${folder}" file="${filename}"`,
              );
            }
            console.log(`[Run] Resolved pseudo-ref "${item}" → "${recordId}"`);
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
    let operation = entry.operation as Record<string, unknown>;
    if (!operation) {
      console.warn(`[Run] Skipping entry with no operation: ${entry.filePath}`);
      return;
    }

    console.log(`[Run] Dispatching ${phase}: ${entry.filePath}`);

    switch (phase) {
      case 'edit':
      case 'backfill': {
        // Resolve any remaining pseudo-references before sending
        operation = await this.resolvePseudoRefs(workbookId, operation);
        await connector.updateRecords(tableSpec, [operation]);

        // After edit/backfill: update reference index with new content
        await this.fileReferenceService.updateRefsForFiles(workbookId, 'main', [
          { path: entry.filePath, content: operation },
        ]);
        console.log(`[Run] Updated refs for ${phase} file: ${entry.filePath}`);

        // Commit to main immediately
        await this.scratchGitService.commitFilesToBranch(
          workbookId as WorkbookId,
          'main',
          [{ path: entry.filePath, content: JSON.stringify(operation, null, 2) }],
          `Publish V2 ${phase}: ${entry.filePath}`,
        );
        console.log(`[Run] Committed ${phase} to main: ${entry.filePath}`);

        // If this is the final operation for this file, also commit to dirty
        await this.commitToDirtyIfFinal(workbookId, planId, phase, entry.filePath, JSON.stringify(operation, null, 2));
        break;
      }
      case 'create': {
        // Strip temporary IDs before sending to connector
        const idField = tableSpec.idColumnRemoteId || 'id';
        const content = { ...operation };
        const idValue = content[idField];
        if (typeof idValue === 'string' && idValue.startsWith('sppi_')) {
          delete content[idField];
        }
        const returned = await connector.createRecords(tableSpec, [content]);
        console.log(`[Run] Create returned:`, JSON.stringify(returned[0]).substring(0, 200));

        // After create: add file to FileIndex with the real ID
        if (returned[0]) {
          const realId = (returned[0] as Record<string, unknown>)[idField];
          if (realId && typeof realId === 'string') {
            const lastSlash = entry.filePath.lastIndexOf('/');
            const folderPath = lastSlash === -1 ? '' : entry.filePath.substring(0, lastSlash);
            const filename = entry.filePath.substring(lastSlash + 1);

            await this.fileIndexService.upsertBatch([
              {
                workbookId,
                folderPath,
                recordId: realId,
                filename,
              },
            ]);
            console.log(`[Run] Added to FileIndex: ${entry.filePath} → ${realId}`);
          }
        }

        // Update reference index with new content (use returned data which has the real ID)
        const finalContent = returned[0] || operation;
        await this.fileReferenceService.updateRefsForFiles(workbookId, 'main', [
          { path: entry.filePath, content: finalContent },
        ]);
        console.log(`[Run] Updated refs for created file: ${entry.filePath}`);

        // Commit to main immediately (with real ID)
        await this.scratchGitService.commitFilesToBranch(
          workbookId as WorkbookId,
          'main',
          [{ path: entry.filePath, content: JSON.stringify(finalContent, null, 2) }],
          `Publish V2 create: ${entry.filePath}`,
        );
        console.log(`[Run] Committed create to main: ${entry.filePath}`);

        // If this is the final operation for this file, also commit to dirty
        await this.commitToDirtyIfFinal(
          workbookId,
          planId,
          phase,
          entry.filePath,
          JSON.stringify(finalContent, null, 2),
        );
        break;
      }
      case 'delete': {
        const idField = tableSpec.idColumnRemoteId || 'id';
        const remoteId = entry.remoteRecordId;
        if (remoteId) {
          await connector.deleteRecords(tableSpec, [{ [idField]: remoteId }]);

          // After delete: remove refs where this file is the source
          await this.db.client.fileReference.deleteMany({
            where: { workbookId, sourceFilePath: entry.filePath },
          });
          console.log(`[Run] Deleted refs for file: ${entry.filePath}`);

          // Remove from FileIndex
          const lastSlash = entry.filePath.lastIndexOf('/');
          const folderPath = lastSlash === -1 ? '' : entry.filePath.substring(0, lastSlash);
          const filename = entry.filePath.substring(lastSlash + 1);
          await this.db.client.fileIndex.deleteMany({
            where: { workbookId, folderPath, filename },
          });
          console.log(`[Run] Removed from FileIndex: ${entry.filePath}`);

          // Delete from main immediately
          await this.scratchGitService.deleteFilesFromBranch(
            workbookId as WorkbookId,
            'main',
            [entry.filePath],
            `Publish V2 delete: ${entry.filePath}`,
          );
          console.log(`[Run] Deleted from main: ${entry.filePath}`);
        } else {
          console.warn(`[Run] Delete entry has no remoteRecordId: ${entry.filePath}`);
        }
        break;
      }
      default:
        throw new Error(`Unknown phase: ${phase}`);
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
