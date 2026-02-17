/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { WorkbookId } from '@spinner/shared-types';
import { randomUUID } from 'crypto';
import { DbService } from '../db/db.service';
import { ScratchGitService } from '../scratch-git/scratch-git.service';
import { FileIndexService } from './file-index.service';
import { FileReferenceService } from './file-reference.service';
import { PipelineInfo, PipelinePhase } from './types';

@Injectable()
export class PipelineBuildService {
  constructor(
    private readonly db: DbService,
    private readonly scratchGitService: ScratchGitService,
    private readonly fileIndexService: FileIndexService,
    private readonly fileReferenceService: FileReferenceService,
  ) {}

  /**
   * Builds the publish pipeline for a given workbook.
   */
  async buildPipeline(workbookId: string, userId: string, connectorAccountId?: string): Promise<PipelineInfo> {
    const pipelineId = randomUUID();
    // Branch name is still useful for the 'Run' phase to have a reference point,
    // but we might not create it here anymore if we don't need it for the pipeline itself.
    // The previous plan said "Dropping Git Branch".
    // However, the *content* of the files comes from the "dirty" branch.
    // We will store the operations in the DB.

    // We keep a consistent branch name format for future use or logging
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

    // Map to store all entries before bulk insert
    const pipelineEntries = new Map<
      string,
      {
        filePath: string;
        editOperation?: any;
        createOperation?: any;
        deleteOperation?: any;
        backfillOperation?: any;
        hasEdit: boolean;
        hasCreate: boolean;
        hasDelete: boolean;
        hasBackfill: boolean;
      }
    >();

    const getOrCreateEntry = (filePath: string) => {
      if (!pipelineEntries.has(filePath)) {
        pipelineEntries.set(filePath, {
          filePath,
          hasEdit: false,
          hasCreate: false,
          hasDelete: false,
          hasBackfill: false,
        });
      }
      return pipelineEntries.get(filePath)!;
    };

    // Cache schemas to avoid repeated reads
    const schemaCache = new Map<string, any>();

    const getSchema = async (folderPath: string) => {
      if (schemaCache.has(folderPath)) return schemaCache.get(folderPath);
      try {
        let file = await this.scratchGitService.getRepoFile(wkbId, 'dirty', `${folderPath}/schema.json`);
        if (!file) {
          file = await this.scratchGitService.getRepoFile(wkbId, 'main', `${folderPath}/schema.json`);
        }
        if (file?.content) {
          const schema = JSON.parse(file.content);
          schemaCache.set(folderPath, schema);
          return schema;
        }
      } catch {
        // ignore
      }
      schemaCache.set(folderPath, null);
      return null;
    };

    const addedPathsSet = new Set(addedFiles.map((f) => f.path));
    let backfillCount = 0;

    // --- Phase 1: [edit] ---
    // Read modified content
    let editCount = 0;
    for (const mod of modifiedFiles) {
      const content = await this.scratchGitService.getRepoFile(wkbId, 'dirty', mod.path);
      if (content) {
        let contentObj: any;
        try {
          contentObj = JSON.parse(content.content);
        } catch {
          // Not JSON? Just commit as is.
          const entry = getOrCreateEntry(mod.path);
          entry.editOperation = { content: content.content };
          entry.hasEdit = true;
          editCount++;
          continue;
        }

        // Determine folder path
        const lastSlash = mod.path.lastIndexOf('/');
        const folderPath = lastSlash === -1 ? '' : mod.path.substring(0, lastSlash);
        const schema = await getSchema(folderPath);

        // Strip refs to NEW files using Schema
        // This prevents FK errors if we point to a record that is created in Phase 2
        const strippedObj = await this.fileReferenceService.stripReferencesWithSchema(
          workbookId,
          contentObj,
          schema,
          addedPathsSet,
          this.fileIndexService,
        );
        const strippedContent = JSON.stringify(strippedObj, null, 2);

        const entry = getOrCreateEntry(mod.path);
        entry.editOperation = { content: strippedContent };
        entry.hasEdit = true;
        editCount++;

        // Check if backfill needed (compare normalized strings)
        const originalContentNormalized = JSON.stringify(contentObj, null, 2);
        if (strippedContent !== originalContentNormalized) {
          entry.backfillOperation = { content: originalContentNormalized };
          entry.hasBackfill = true;
          backfillCount++;
        }
      }
    }

    if (editCount > 0) {
      phases.push({ type: 'edit', recordCount: editCount });
    }

    // --- Phase 2: [create] ---
    let createCount = 0;
    // backfillCount, addedPathsSet, getSchema, schemaCache already defined above

    for (const add of addedFiles) {
      const fileData = await this.scratchGitService.getRepoFile(wkbId, 'dirty', add.path);
      if (fileData) {
        let contentObj: any;
        try {
          contentObj = JSON.parse(fileData.content);
        } catch {
          // Not JSON? Just commit as is.
          const entry = getOrCreateEntry(add.path);
          entry.createOperation = { content: fileData.content };
          entry.hasCreate = true;
          createCount++;
          continue;
        }

        // Determine folder path
        const lastSlash = add.path.lastIndexOf('/');
        const folderPath = lastSlash === -1 ? '' : add.path.substring(0, lastSlash);
        const schema = await getSchema(folderPath);

        // Strip refs to other new files using Schema
        const strippedObj = await this.fileReferenceService.stripReferencesWithSchema(
          workbookId,
          contentObj,
          schema,
          addedPathsSet,
          this.fileIndexService,
        );
        const strippedContent = JSON.stringify(strippedObj, null, 2);

        const entry = getOrCreateEntry(add.path);
        entry.createOperation = { content: strippedContent };
        entry.hasCreate = true;
        createCount++;

        // Check if backfill needed (compare normalized strings)
        const originalContentNormalized = JSON.stringify(contentObj, null, 2);
        if (strippedContent !== originalContentNormalized) {
          entry.backfillOperation = { content: originalContentNormalized };
          entry.hasBackfill = true;
          backfillCount++;
        }
      }
    }

    if (createCount > 0) {
      phases.push({ type: 'create', recordCount: createCount });
    }
    // --- Phase 3: [delete] ---
    for (const del of deletedFiles) {
      const entry = getOrCreateEntry(del.path);
      entry.deleteOperation = {}; // Marker
      entry.hasDelete = true;
    }

    if (deletedFiles.length > 0) {
      phases.push({ type: 'delete', recordCount: deletedFiles.length });
    }

    // --- Phase 4: [backfill] ---
    // Identify files that need backfill (were stripped in Phase 2)
    // We compare the stripped content with the original content.
    for (const add of addedFiles) {
      const entry = pipelineEntries.get(add.path);
      if (entry && entry.hasCreate) {
        const rawContent = await this.scratchGitService.getRepoFile(wkbId, 'dirty', add.path);
        if (rawContent?.content) {
          const originalJson = JSON.parse(rawContent.content);
          const strippedJson = entry.createOperation.content;

          // Simple deep equality check or JSON string comparison
          if (JSON.stringify(originalJson) !== JSON.stringify(strippedJson)) {
            entry.backfillOperation = { content: originalJson };
            entry.hasBackfill = true;
            backfillCount++;
          }
        }
      }
    }

    if (backfillCount > 0) {
      phases.push({ type: 'backfill', recordCount: backfillCount });
    }

    // --- Phase 0: Ref-Clearing Edits (Inserted into Phase 1) ---
    // This must happen AFTER we know all deleted files, but modifying the [edit] phase entries.
    // We already have `pipelineEntries` populated with user edits.
    // Now we add "synthetic" edits for ref clearing.

    if (deletedFiles.length > 0) {
      const refClearingEdits = await this.buildRefClearingEdits(wkbId, userId, deletedFiles);

      for (const edit of refClearingEdits) {
        // If the user ALREADY edited this file (hasEdit=true), we need to merge the ref-clearing changes
        // into the user's edit based on the DIRTY content (which includes user's edit).
        // If the user did NOT edit this file, we create a new entry based on DIRTY content (which is same as Main for this file).

        // Actually, `buildRefClearingEdits` should read from DIRTY, so it gets the latest state (including user edits).
        // So we just overwrite/set the editOperation with the cleared content.

        const entry = getOrCreateEntry(edit.path);
        entry.editOperation = { content: edit.content };
        entry.hasEdit = true;
        // If it wasn't counted yet (not in modifiedFiles), increment count??
        // Wait, modifiedFiles loop above already counted user edits.
        // We need to be careful not to double count or miss counting.
        // Simplest: Recalculate editCount based on map at the end.
      }
    }

    // Recalculate phases based on final map state
    const finalEditCount = Array.from(pipelineEntries.values()).filter((e) => e.hasEdit).length;

    // Update the 'edit' phase count in the array (it's the first one if exists)
    const editPhaseIndex = phases.findIndex((p) => p.type === 'edit');
    if (finalEditCount > 0) {
      if (editPhaseIndex !== -1) {
        phases[editPhaseIndex].recordCount = finalEditCount;
      } else {
        // Insert at beginning
        phases.unshift({ type: 'edit', recordCount: finalEditCount });
      }
    }

    // Persist Pipeline
    await this.db.client.publishPipeline.create({
      data: {
        id: pipelineId,
        workbookId: wkbId,
        userId,
        status: 'building',
        branchName,
        phases: [], // Initial empty phases
        connectorAccountId: connectorAccountId || null,
      },
    });

    // Create Entries
    // Prisma createMany is supported for some DBs, and we assume Postgres here.
    if (pipelineEntries.size > 0) {
      await this.db.client.publishPipelineEntry.createMany({
        data: Array.from(pipelineEntries.values()).map((e) => ({
          pipelineId,
          filePath: e.filePath,
          editOperation: e.editOperation ?? undefined,
          createOperation: e.createOperation ?? undefined,
          deleteOperation: e.deleteOperation ?? undefined,
          backfillOperation: e.backfillOperation ?? undefined,
          hasEdit: e.hasEdit,
          hasCreate: e.hasCreate,
          hasDelete: e.hasDelete,
          hasBackfill: e.hasBackfill,
          editStatus: e.hasEdit ? 'pending' : undefined,
          createStatus: e.hasCreate ? 'pending' : undefined,
          deleteStatus: e.hasDelete ? 'pending' : undefined,
          backfillStatus: e.hasBackfill ? 'pending' : undefined,
        })),
      });
    }

    return {
      pipelineId,
      workbookId,
      userId,
      branchName,
      status: 'ready',
      phases,
      createdAt: new Date(),
    };
  }

  /**
   * Generates synthetic edits to clear references to records that are about to be deleted.
   * This prevents foreign key constraint errors during the delete phase.
   */
  private async buildRefClearingEdits(
    workbookId: string,
    userId: string,
    deletedFiles: Array<{ path: string }>,
  ): Promise<Array<{ path: string; content: object }>> {
    const deletedPaths = new Set(deletedFiles.map((f) => f.path));

    // 1. Identify targets (files being deleted)
    // We need to find references to these files.
    // References can be by:
    // - Path (for @/ refs)
    // - Record ID (for resolved refs)

    // Also caching schemas here might be useful if we process many files in same folder.
    // But we can reuse the `getSchema` helper if we move it to class level or pass it?
    // `getSchema` is defined inside `buildPipeline`.
    // I should move `getSchema` to class private method or duplicate logic?
    // Better to have it as a private method or simple helper.
    // For now I'll duplicate the simple logic or better yet, make schemaCache a class property?
    // No, scope it to request.
    // I can just re-instantiate a local cache here.

    const schemaCache = new Map<string, any>();
    const getSchema = async (folderPath: string) => {
      if (schemaCache.has(folderPath)) return schemaCache.get(folderPath);
      try {
        let file = await this.scratchGitService.getRepoFile(
          workbookId as WorkbookId,
          'dirty',
          `${folderPath}/schema.json`,
        );
        if (!file) {
          file = await this.scratchGitService.getRepoFile(
            workbookId as WorkbookId,
            'main',
            `${folderPath}/schema.json`,
          );
        }
        if (file?.content) {
          const schema = JSON.parse(file.content);
          schemaCache.set(folderPath, schema);
          return schema;
        }
      } catch {
        // ignore
      }
      schemaCache.set(folderPath, null);
      return null;
    };

    const targets: Array<{ folderPath: string; fileName?: string; recordId?: string }> = [];

    for (const del of deletedFiles) {
      // Parse path to get folder and filename
      const lastSlash = del.path.lastIndexOf('/');
      const folderPath = lastSlash === -1 ? '' : del.path.substring(0, lastSlash);
      const fileName = del.path.substring(lastSlash + 1);

      // Get Record ID from FileIndex
      const recordId = await this.fileIndexService.getRecordId(workbookId, folderPath, fileName);

      targets.push({
        folderPath,
        fileName,
        recordId: recordId ?? undefined,
      });
    }

    // 2. Find inbound references
    // We check both 'main' and 'dirty' to be safe, but primarily we care about what's currently referring to them.
    const inboundRefs = await this.fileReferenceService.findRefsToFiles(workbookId, targets, [
      'main',
      `dirty/${userId}`,
    ]);

    if (inboundRefs.length === 0) {
      return [];
    }

    // 3. Filter out refs from files that are ALSO being deleted
    const sourceFilesToFix = new Set<string>();
    for (const ref of inboundRefs) {
      if (!deletedPaths.has(ref.sourceFilePath)) {
        sourceFilesToFix.add(ref.sourceFilePath);
      }
    }

    if (sourceFilesToFix.size === 0) {
      return [];
    }

    // 4. Generate edits for each source file
    const edits: Array<{ path: string; content: object }> = [];
    const deletedRecordIds = new Set(targets.map((t) => t.recordId).filter(Boolean) as string[]);

    for (const sourcePath of sourceFilesToFix) {
      // Read current content from DIRTY (so we include any user edits)

      let rawContent = await this.scratchGitService.getRepoFile(workbookId as WorkbookId, 'dirty', sourcePath);

      if (!rawContent) {
        rawContent = await this.scratchGitService.getRepoFile(workbookId as WorkbookId, 'main', sourcePath);
      }

      if (!rawContent?.content) continue;

      let jsonContent: any;
      try {
        jsonContent = JSON.parse(rawContent.content);
      } catch {
        continue; // Skip invalid JSON
      }

      // Determine folder path for source file to get its schema
      const lastSlash = sourcePath.lastIndexOf('/');
      const folderPath = lastSlash === -1 ? '' : sourcePath.substring(0, lastSlash);
      const schema = await getSchema(folderPath);

      // Apply stripping logic using Schema
      // We pass `deletedPaths` as `addedPaths` (to strip @/ refs pointing to them)
      // We pass `deletedRecordIds` as `idsToStrip`

      const newContentIdx = await this.fileReferenceService.stripReferencesWithSchema(
        workbookId,
        jsonContent,
        schema,
        deletedPaths,
        this.fileIndexService,
        deletedRecordIds,
      );

      // Compare to check if changed
      // Simple stringify comparison
      const originalStr = JSON.stringify(jsonContent);
      const newStr = JSON.stringify(newContentIdx);

      if (originalStr !== newStr) {
        edits.push({ path: sourcePath, content: newContentIdx });
      }
    }

    return edits;
  }

  async listPipelines(workbookId: string, connectorAccountId?: string) {
    return this.db.client.publishPipeline.findMany({
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
}
