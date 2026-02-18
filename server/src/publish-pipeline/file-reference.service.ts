/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { PipelineSchemaService } from './pipeline-schema.service';
import { RefCleanerService } from './ref-cleaner.service';
import { parsePath } from './utils';

export interface ExtractedRef {
  sourceFilePath: string;
  targetFolderPath: string;
  targetFileName?: string;
  targetFileRecordId?: string;
  targetFolderId?: string;
}

@Injectable()
export class FileReferenceService {
  constructor(
    private readonly db: DbService,
    private readonly refCleanerService: RefCleanerService,
    private readonly schemaService: PipelineSchemaService,
  ) {}

  /**
   * Extract references from a JSON object.
   * - Finds x-scratch-foreign-key references in schema/content.
   */
  extractReferences(sourceFilePath: string, content: any, schema?: any): ExtractedRef[] {
    const refs: ExtractedRef[] = [];

    // Pass 2: Use schema paths to find x-scratch-foreign-key refs
    if (schema) {
      const fkPaths = this.refCleanerService.extractForeignKeyPaths(schema);

      for (const fk of fkPaths) {
        // Get all nodes at this path (handles arrays)
        const nodes = this.getNodesByPath(content, fk.path);

        for (const node of nodes) {
          const ids = this.extractIds(node, fk.map);
          for (const id of ids) {
            refs.push({
              sourceFilePath,
              targetFolderPath: '', // will be resolved later
              targetFileRecordId: id,
              targetFolderId: fk.targetFolderId,
            });
          }
        }
      }
    }

    // Deduplicate
    const uniqueRefs = new Map<string, ExtractedRef>();
    for (const ref of refs) {
      const key = `${ref.targetFolderId || ref.targetFolderPath}|${ref.targetFileName || ''}|${ref.targetFileRecordId || ''}`;
      if (!uniqueRefs.has(key)) {
        uniqueRefs.set(key, ref);
      }
    }

    return Array.from(uniqueRefs.values());
  }

  /**
   * Retrieves all values at a given path from the content object.
   * Handles '[]' in the path by mapping over arrays.
   */
  getNodesByPath(root: any, path: string[]): any[] {
    if (!root) return [];
    if (path.length === 0) return [root];

    let current = [root];

    for (const segment of path) {
      const next: any[] = [];
      for (const node of current) {
        if (!node) continue;

        if (segment === '[]') {
          if (Array.isArray(node)) {
            next.push(...node);
          }
        } else {
          if (node[segment] !== undefined) {
            next.push(node[segment]);
          }
        }
      }
      current = next;
    }

    return current;
  }

  /**
   * Extracts IDs from a value.
   * - If value is array, process each item.
   * - If map is provided, looks for property `map` in object/item.
   * - Else uses value directly.
   */
  private extractIds(value: any, map?: string): string[] {
    if (!value) return [];

    // Normalize to array
    const items = Array.isArray(value) ? value : [value];
    const ids: string[] = [];

    for (const item of items) {
      if (!item) continue;

      if (map) {
        // expect object with key `map`
        if (typeof item === 'object' && item !== null && item[map] !== undefined) {
          const val = item[map];
          if (typeof val === 'string') ids.push(val);
        }
      } else {
        // use item directly if string
        if (typeof item === 'string') {
          ids.push(item);
        }
      }
    }
    return ids;
  }

  /**
   * Update references for a batch of files.
   * 1. Remove existing refs for these files.
   * 2. Extract new refs.
   * 3. Bulk insert.
   */
  async updateRefsForFiles(
    workbookId: string,
    branch: string,
    files: Array<{ path: string; content: any }>,
    schema?: any,
  ): Promise<void> {
    // 1. Remove existing refs
    const filePaths = files.map((f) => f.path);
    await this.db.client.fileReference.deleteMany({
      where: {
        workbookId,
        branch,
        sourceFilePath: { in: filePaths },
      },
    });

    // 2. Extract new refs
    const allRefs: ExtractedRef[] = [];
    const schemaCache = new Map<string, any>();

    for (const file of files) {
      let fileSchema = schema;
      if (!fileSchema) {
        // Determine folder path
        const { folderPath } = parsePath(file.path);
        fileSchema = await this.schemaService.getJsonSchema(workbookId, folderPath, schemaCache);
      }

      const refs = this.extractReferences(file.path, file.content, fileSchema);
      allRefs.push(...refs);
    }

    if (allRefs.length === 0) return;

    // 2b. Resolve targetFolderIds to targetFolderPath
    const folderIdsToResolve = new Set(allRefs.filter((r) => r.targetFolderId).map((r) => r.targetFolderId as string));

    const folderIdToNameMap = new Map<string, string>();
    if (folderIdsToResolve.size > 0) {
      const folders = await this.db.client.dataFolder.findMany({
        where: { id: { in: Array.from(folderIdsToResolve) } },
        select: { id: true, path: true },
      });
      for (const folder of folders) {
        folderIdToNameMap.set(folder.id, folder.path || '');
      }
    }

    // 3. Insert
    await this.db.client.fileReference.createMany({
      data: allRefs.map((ref) => {
        let folderPath = ref.targetFolderPath;
        if (ref.targetFolderId && folderIdToNameMap.has(ref.targetFolderId)) {
          folderPath = folderIdToNameMap.get(ref.targetFolderId)!;
        }

        return {
          workbookId,
          branch,
          sourceFilePath: ref.sourceFilePath,
          targetFolderPath: folderPath,
          targetFileName: ref.targetFileName,
          targetFileRecordId: ref.targetFileRecordId,
        };
      }),
    });
  }

  /**
   * Find files that reference the given targets.
   * Used for resolving dependencies (e.g., delete phase).
   */
  async findRefsToFiles(
    workbookId: string,
    targets: Array<{ folderPath: string; fileName?: string; recordId?: string }>,
    branches: string[] = ['main', 'dirty'],
  ): Promise<
    {
      sourceFilePath: string;
      branch: string;
    }[]
  > {
    if (targets.length === 0) {
      return [];
    }

    // This is a complex OR query.
    // For each target, we want to find refs that match (folder AND filename) OR (folder AND recordId).

    const conditions = targets.map((t) => {
      const orList: any[] = [];
      if (t.fileName && t.folderPath) {
        orList.push({ targetFolderPath: t.folderPath, targetFileName: t.fileName });
      }
      if (t.recordId) {
        orList.push({ targetFileRecordId: t.recordId });
      }
      return { OR: orList };
    });

    return this.db.client.fileReference.findMany({
      where: {
        workbookId,
        branch: { in: branches },
        OR: conditions,
      },
      select: {
        sourceFilePath: true,
        branch: true,
      },
    });
  }

  /**
   * Strip references that point to any of the paths in the set.
   * Returns a deep copy of content with matching refs replaced by null.
   */
  /**
   * Strip references that point to any of the paths in the set or are unresolvable pseudo-refs.
   * Returns a deep copy of content with matching refs replaced by null.
   */

  /**
   * Legacy string matching stripper (kept for fallback or non-schema cases if needed, but deprecated for V2)
   */
  stripReferences(content: any, pathsToStrip: Set<string>): any {
    if (!content) return content;

    if (typeof content === 'string') {
      if (content.startsWith('@/')) {
        // defined as @/path/to/file.json
        const refPath = content.substring(2);
        // Normalize check: pathsToStrip might be "path/to/file.json" or "/path/to/file.json"
        // We check both.
        if (pathsToStrip.has(refPath) || pathsToStrip.has('/' + refPath)) {
          return null;
        }
      }
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((item) => this.stripReferences(item, pathsToStrip));
    }

    if (typeof content === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(content)) {
        result[key] = this.stripReferences(value, pathsToStrip);
      }
      return result;
    }

    return content;
  }
  async deleteForWorkbook(workbookId: string): Promise<void> {
    await this.db.client.fileReference.deleteMany({
      where: { workbookId },
    });
  }
}
