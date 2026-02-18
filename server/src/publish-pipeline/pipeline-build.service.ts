// /* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { WorkbookId } from '@spinner/shared-types';
import { randomUUID } from 'crypto';
import { ParsedContent } from 'src/utils/objects';
import { DbService } from '../db/db.service';
import { WSLogger } from '../logger';
import { DIRTY_BRANCH, MAIN_BRANCH, ScratchGitService } from '../scratch-git/scratch-git.service';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';
import { PipelineSchemaService } from './pipeline-schema.service';
import { RefCleanerService } from './ref-cleaner.service';
import { PipelinePhase, PublishPlanInfo, PublishPlanPhase } from './types';
import { parsePath } from './utils';

@Injectable()
export class PipelineBuildService {
  constructor(
    private readonly db: DbService,
    private readonly scratchGitService: ScratchGitService,
    private readonly fileIndexService: FileIndexService,
    private readonly fileReferenceService: FileReferenceService,
    private readonly refCleanerService: RefCleanerService,
    private readonly schemaService: PipelineSchemaService,
  ) {}

  /**
   * Builds the publish pipeline for a given workbook.
   */
  async buildPipeline(workbookId: string, userId: string, connectorAccountId?: string): Promise<PublishPlanInfo> {
    const pipelineId = randomUUID();
    const branchName = `publish/${userId}/${pipelineId}`;
    const wkbId = workbookId as WorkbookId;

    // 2. Get diff between main and dirty
    let changes = (await this.scratchGitService.getRepoStatus(wkbId)) as Array<{
      path: string;
      status: 'added' | 'modified' | 'deleted';
    }>;

    if (connectorAccountId) {
      // Find all data folders for this connector in this workbook
      const dataFolders = await this.db.client.dataFolder.findMany({
        where: { workbookId: wkbId, connectorAccountId },
      });

      const prefixes = dataFolders
        .map((df) => df.path)
        .filter((p): p is string => !!p)
        .map((p) => (p.startsWith('/') ? p.substring(1) : p)) // Normalize: remove leading slash
        .map((p) => (p.endsWith('/') ? p : p + '/'));

      if (prefixes.length > 0) {
        changes = changes.filter((c) => prefixes.some((prefix) => c.path.startsWith(prefix)));
      } else {
        // No folders? Then no changes for this connector.
        changes = [];
      }
    }

    const modifiedFiles = changes.filter((c) => c.status === 'modified');
    const addedFiles = changes.filter((c) => c.status === 'added');
    const deletedFiles = changes.filter((c) => c.status === 'deleted');

    const phases: PipelinePhase[] = [];

    // Cache schemas to avoid repeated reads
    const schemaCache = new Map<string, any>();

    const getSchema = async (folderPath: string) => {
      return this.schemaService.getJsonSchema(workbookId, folderPath, schemaCache);
    };

    const addedPathsSet = new Set(addedFiles.map((f) => f.path));
    const deletedPathsSet = new Set(deletedFiles.map((f) => f.path));

    // --- Prepare for "Delete Ref Clearing" ---
    // 1. Identify Deleted Record IDs

    const deletedRecordIds = new Set<string>();
    const deletedFileRecordIds = new Map<string, string | null>();
    const targetsForRefCheck: Array<{ folderPath: string; fileName: string; recordId?: string }> = [];

    for (const del of deletedFiles) {
      const { folderPath, filename: fileName } = parsePath(del.path);
      const recordId = await this.fileIndexService.getRecordId(workbookId, folderPath, fileName);

      if (recordId) deletedRecordIds.add(recordId);
      deletedFileRecordIds.set(del.path, recordId || null);
      targetsForRefCheck.push({ folderPath, fileName, recordId: recordId || undefined });
    }

    // 2. Identify Inbound Refs to Deleted Files
    // TODO: do we need to search in both branches?
    const searchBranches = [MAIN_BRANCH, DIRTY_BRANCH];
    const inboundRefs = await this.fileReferenceService.findRefsToFiles(workbookId, targetsForRefCheck, searchBranches);

    // Identify files that need editing because they reference a deleted file
    const filesReferringToDeletedFiles = new Set<string>();
    for (const ref of inboundRefs) {
      // Exclude files that are themselves being deleted
      if (!deletedPathsSet.has(ref.sourceFilePath)) {
        filesReferringToDeletedFiles.add(ref.sourceFilePath);
      }
    }

    // --- Phase 1: [edit] ---
    // Process Union of Modified Files and Ref-Clearing Candidate Files
    const filesToProcessInEditPhase = new Set(modifiedFiles.map((f) => f.path));
    for (const p of filesReferringToDeletedFiles) filesToProcessInEditPhase.add(p);

    let editCount = 0;
    const planEntries: Array<{
      filePath: string;
      phase: PublishPlanPhase;
      operation: ParsedContent;
      remoteRecordId?: string | null;
      status: string;
    }> = [];

    for (const filePath of filesToProcessInEditPhase) {
      WSLogger.info({
        source: 'PipelineBuildService.buildPipeline',
        message: `Processing file in edit phase: ${filePath}`,
        workbookId,
      });
      // Fetch content: try Dirty first, fallback to main
      // Fallback is needed since we might need to clear refs from files that are deleted in dirty.
      let fileData = await this.scratchGitService.getRepoFile(wkbId, 'dirty', filePath);
      if (!fileData) {
        WSLogger.warn({
          source: 'PipelineBuildService.buildPipeline',
          message: `File not found in dirty branch, falling back to main: ${filePath}`,
          workbookId,
        });
        fileData = await this.scratchGitService.getRepoFile(wkbId, 'main', filePath);
      }

      if (fileData?.content) {
        let contentObj: ParsedContent;
        try {
          contentObj = JSON.parse(fileData.content) as ParsedContent;
        } catch {
          // Not JSON? Just commit as is if it was user-modified.
          // TODO: review
          if (filesToProcessInEditPhase.has(filePath) && modifiedFiles.some((m) => m.path === filePath)) {
            planEntries.push({
              filePath,
              phase: 'edit',
              operation: JSON.parse(fileData.content) as ParsedContent,
              status: 'pending',
            });
            editCount++;
          }
          continue;
        }

        const { folderPath } = parsePath(filePath);
        const schema = await getSchema(folderPath);

        // --- TWO PASS STRIPPING ---

        // Pass 1: Strip references to DELETED records.
        // We use deletedPathsSet as "addedPaths" (masking) so pseudo-refs to them are stripped.
        // We use deletedRecordIds to strip by ID.
        // Mode = ALL (strips both IDs and Pseudo-refs to 'addedPaths').
        const pass1ContentObj = await this.refCleanerService.stripReferencesWithSchema(
          workbookId,
          contentObj,
          schema,
          deletedPathsSet,

          deletedRecordIds,
          'IDS_ONLY', // Strip Deleted IDs and Deleted Pseudo-refs
        );
        const pass1ContentStr = JSON.stringify(pass1ContentObj, null, 2);

        // Pass 2: Strip references to NEW records (Pseudo-refs).
        // Mode = PSEUDO_ONLY.
        const pass2ContentObj = await this.refCleanerService.stripReferencesWithSchema(
          workbookId,
          pass1ContentObj, // Input is result of Pass 1
          schema,
          addedPathsSet,

          undefined, // No ID stripping in this pass
          'PSEUDO_ONLY',
        );
        const pass2ContentStr = JSON.stringify(pass2ContentObj, null, 2);

        // Determine Edit Operation
        const originalContentStr = JSON.stringify(contentObj, null, 2);
        const isUserModified = modifiedFiles.some((m) => m.path === filePath);
        const isRefCleared = pass1ContentStr !== originalContentStr;
        const isPseudoStripped = pass2ContentStr !== pass1ContentStr;

        if (isUserModified || isRefCleared || isPseudoStripped) {
          planEntries.push({
            filePath,
            phase: 'edit',
            operation: pass2ContentObj,
            status: 'pending',
          });
          editCount++;

          // Backfill Logic
          // If Pass 2 != Pass 1, it means we stripped pseudo-refs.
          // We backfill with Pass 1 content.
          if (pass2ContentStr !== pass1ContentStr) {
            planEntries.push({
              filePath,
              phase: 'backfill',
              operation: pass1ContentObj,
              status: 'pending',
            });
          }
        }
      }
    }

    if (editCount > 0) {
      phases.push({ type: 'edit', recordCount: editCount });
    }

    // --- Phase 2: [create] ---
    let createCount = 0;

    for (const add of addedFiles) {
      const fileData = await this.scratchGitService.getRepoFile(wkbId, 'dirty', add.path);
      if (fileData?.content) {
        let contentObj: ParsedContent;
        try {
          contentObj = JSON.parse(fileData.content) as ParsedContent;
        } catch {
          planEntries.push({
            filePath: add.path,
            phase: 'create',
            operation: JSON.parse(fileData.content) as ParsedContent,
            status: 'pending',
          });
          createCount++;
          continue;
        }

        const { folderPath } = parsePath(add.path);
        const schema = await getSchema(folderPath);

        // Pass 1: Strip Deleted
        const pass1ContentObj = await this.refCleanerService.stripReferencesWithSchema(
          workbookId,
          contentObj,
          schema,
          deletedPathsSet,
        );
        const pass1ContentStr = JSON.stringify(pass1ContentObj, null, 2);

        // Pass 2: Strip Pseudo
        const pass2ContentObj = await this.refCleanerService.stripReferencesWithSchema(
          workbookId,
          pass1ContentObj,
          schema,
          addedPathsSet,
          undefined,
          'PSEUDO_ONLY',
        );
        const pass2ContentStr = JSON.stringify(pass2ContentObj, null, 2);

        // Determine Edit Operation
        const originalContentStr = JSON.stringify(contentObj, null, 2);

        WSLogger.info({
          source: 'PipelineBuildService.buildPipeline',
          message: `Debug Stripping: ${add.path}`,
          workbookId,
          data: {
            addedPaths: Array.from(addedPathsSet),
            original: originalContentStr,
            pass1: pass1ContentStr,
            pass2: pass2ContentStr,
            schemaFound: !!schema,
          },
        });

        planEntries.push({
          filePath: add.path,
          phase: 'create',
          operation: pass2ContentObj,
          status: 'pending',
        });
        createCount++;

        if (pass2ContentStr !== pass1ContentStr) {
          planEntries.push({
            filePath: add.path,
            phase: 'backfill',
            operation: pass1ContentObj,
            status: 'pending',
          });
        }
      }
    }

    if (createCount > 0) {
      phases.push({ type: 'create', recordCount: createCount });
    }

    // --- Phase 3: [delete] ---
    for (const del of deletedFiles) {
      // recordId was already looked up above when building deletedRecordIds
      const recordId = deletedFileRecordIds.get(del.path);

      planEntries.push({
        filePath: del.path,
        phase: 'delete',
        operation: {},
        remoteRecordId: recordId || null,
        status: 'pending',
      });
    }

    if (deletedFiles.length > 0) {
      phases.push({ type: 'delete', recordCount: deletedFiles.length });
    }

    // Persist Pipeline (PublishPlan)
    await this.db.client.publishPlan.create({
      data: {
        id: pipelineId,
        workbookId: wkbId,
        userId,
        status: 'planning',
        branchName,
        phases: [],
        connectorAccountId: connectorAccountId || null,
      },
    });

    // Create Entries
    if (planEntries.length > 0) {
      await this.db.client.publishPlanEntry.createMany({
        data: planEntries.map((e) => ({
          planId: pipelineId,
          filePath: e.filePath,
          phase: e.phase,
          operation: e.operation,
          remoteRecordId: e.remoteRecordId ?? null,
          status: e.status,
        })),
      });
    }

    // Mark as planned (ready to run)
    await this.db.client.publishPlan.update({
      where: { id: pipelineId },
      data: { status: 'planned' },
    });

    return {
      pipelineId,
      workbookId,
      userId,
      phases,
      branchName,
      createdAt: new Date(),
      status: 'planned',
    };
  }

  async listPipelines(workbookId: string, connectorAccountId?: string) {
    return await this.db.client.publishPlan.findMany({
      where: {
        workbookId,
        connectorAccountId: connectorAccountId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });
  }

  async listFileIndex(workbookId: string) {
    return await this.db.client.fileIndex.findMany({
      where: { workbookId },
      orderBy: [{ folderPath: 'asc' }, { filename: 'asc' }],
    });
  }

  async listRefIndex(workbookId: string) {
    return await this.db.client.fileReference.findMany({
      where: { workbookId },
      orderBy: [{ sourceFilePath: 'asc' }, { targetFolderPath: 'asc' }],
    });
  }

  async listPipelineEntries(pipelineId: string) {
    return await this.db.client.publishPlanEntry.findMany({
      where: { planId: pipelineId },
      orderBy: [{ phase: 'asc' }, { filePath: 'asc' }],
    });
  }

  async deletePipeline(pipelineId: string) {
    return await this.db.client.publishPlan.delete({
      where: { id: pipelineId },
    });
  }
}
