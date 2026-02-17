/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

export interface ExtractedRef {
  sourceFilePath: string;
  targetFolderPath: string;
  targetFileName?: string;
  targetFileRecordId?: string;
  targetFolderId?: string;
}

@Injectable()
export class FileReferenceService {
  constructor(private readonly db: DbService) {}

  /**
   * Extract references from a JSON object.
   * - Finds x-scratch-foreign-key references in schema/content.
   */
  extractReferences(sourceFilePath: string, content: any, schema?: any): ExtractedRef[] {
    const refs: ExtractedRef[] = [];

    // Pass 2: Use schema paths to find x-scratch-foreign-key refs
    if (schema) {
      const fkPaths = this.extractForeignKeyPaths(schema);

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
   * Traverses the schema to find all paths that are marked as foreign keys.
   */
  extractForeignKeyPaths(schema: any): Array<{ path: string[]; targetFolderId: string; map?: string }> {
    const results: Array<{ path: string[]; targetFolderId: string; map?: string }> = [];

    const walk = (schemaNode: any, currentPath: string[]) => {
      if (!schemaNode || typeof schemaNode !== 'object') return;

      // Check for x-scratch-foreign-key
      const foreignKey = schemaNode['x-scratch-foreign-key'];

      if (foreignKey) {
        let linkedTableId: string | undefined;
        let map: string | undefined;

        if (typeof foreignKey === 'string') {
          linkedTableId = foreignKey;
        } else if (typeof foreignKey === 'object' && foreignKey.linkedTableId) {
          linkedTableId = foreignKey.linkedTableId;
          map = foreignKey.map;
        }

        if (linkedTableId) {
          results.push({
            path: currentPath,
            targetFolderId: linkedTableId,
            map: map,
          });
        }
      }

      // Recurse
      if (schemaNode.properties) {
        for (const [key, prop] of Object.entries(schemaNode.properties)) {
          walk(prop, [...currentPath, key]);
        }
      }

      if (schemaNode.items) {
        if (Array.isArray(schemaNode.items)) {
          // tuple validation not supported for now in this simple walker
        } else {
          walk(schemaNode.items, [...currentPath, '[]']);
        }
      }
    };

    walk(schema, []);
    return results;
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
    for (const file of files) {
      const refs = this.extractReferences(file.path, file.content, schema);
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
  ) {
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
  async stripReferencesWithSchema(
    workbookId: string,
    content: any,
    schema: any,
    addedPaths: Set<string>,
    fileIndexService: { getRecordId: (wkbId: string, folder: string, file: string) => Promise<string | null> },
    idsToStrip?: Set<string>,
  ): Promise<any> {
    if (!content || !schema) return content;

    // Deep copy to avoid mutating original
    const result = JSON.parse(JSON.stringify(content));

    // 1. Find all FK paths in the schema
    const fkPaths = this.extractForeignKeyPaths(schema);

    for (const fk of fkPaths) {
      // 2. Get nodes at this path in the content
      // We need to modify them in place, so getNodesByPath might not be enough if it returns values.
      // We'll write a specific traverser that can update values.
      await this.stripAtNodes(workbookId, result, fk.path, addedPaths, fileIndexService, idsToStrip);
    }

    return result;
  }

  // Helper to traverse and strip at specific path
  private async stripAtNodes(
    workbookId: string,
    root: any,
    path: string[],
    addedPaths: Set<string>,
    fileIndexService: { getRecordId: (wkbId: string, folder: string, file: string) => Promise<string | null> },
    idsToStrip?: Set<string>,
  ): Promise<void> {
    if (!root) return;
    if (path.length === 0) return;

    const [head, ...tail] = path;

    if (head === '[]') {
      if (Array.isArray(root)) {
        for (let i = 0; i < root.length; i++) {
          if (tail.length === 0) {
            // Reached the leaf node (FK value) inside array
            root[i] = await this.checkAndStrip(workbookId, root[i], addedPaths, fileIndexService, idsToStrip);
          } else {
            await this.stripAtNodes(workbookId, root[i], tail, addedPaths, fileIndexService, idsToStrip);
          }
        }
      }
    } else {
      if (root[head] !== undefined) {
        if (tail.length === 0) {
          // Reached the leaf node (FK value)
          root[head] = await this.checkAndStrip(workbookId, root[head], addedPaths, fileIndexService, idsToStrip);
        } else {
          await this.stripAtNodes(workbookId, root[head], tail, addedPaths, fileIndexService, idsToStrip);
        }
      }
    }
  }

  private async checkAndStrip(
    workbookId: string,
    value: any,
    addedPaths: Set<string>,
    fileIndexService: { getRecordId: (wkbId: string, folder: string, file: string) => Promise<string | null> },
    idsToStrip?: Set<string>,
  ): Promise<any> {
    // Helper to check a single value (string or array of strings)
    // Actually schema usually points to the specific field.
    // Multiref might be an array of strings.

    if (Array.isArray(value)) {
      const newArray = [];
      for (const item of value) {
        const stripped = await this.shouldStrip(workbookId, item, addedPaths, fileIndexService, idsToStrip);
        if (!stripped) newArray.push(item);
      }
      return newArray;
    } else {
      const stripped = await this.shouldStrip(workbookId, value, addedPaths, fileIndexService, idsToStrip);
      return stripped ? null : value;
    }
  }

  private async shouldStrip(
    workbookId: string,
    value: any,
    addedPaths: Set<string>,
    fileIndexService: { getRecordId: (wkbId: string, folder: string, file: string) => Promise<string | null> },
    idsToStrip?: Set<string>,
  ): Promise<boolean> {
    if (typeof value !== 'string') return false;

    // Check 0: Is it in idsToStrip?
    if (idsToStrip && idsToStrip.has(value)) {
      return true;
    }

    // Check 1: Is it a pseudo-ref?
    if (value.startsWith('@/')) {
      const targetPath = value.substring(2);

      // If it points to an added file, STRIP IT.
      // (Normalize check: targetPath matching addedPaths)
      if (addedPaths.has(targetPath) || addedPaths.has('/' + targetPath)) {
        return true;
      }

      // If it points to a file that DOES NOT EXIST in FileIndex, STRIP IT.
      // (This handles the case where it's a ref to a non-existent file, or a file not in addedFiles and not in DB)
      // To check logic:
      // If it exists in FileIndex -> valid ref to existing record -> KEEP.
      // If it is in addedFiles -> valid ref to FUTURE record -> STRIP (and backfill later).
      // If neither -> INVALID ref -> STRIP (and backfill later? or just lose it?
      // Mackerel logic was: "stripUnresolvableAtRefs". If !recordId, strip.
      // Here: if !recordId AND !addedFiles.has(targetPath), then it is truly unresolvable.

      const lastSlash = targetPath.lastIndexOf('/');
      const folder = lastSlash === -1 ? '' : targetPath.substring(0, lastSlash);
      const filename = targetPath.substring(lastSlash + 1);

      const recordId = await fileIndexService.getRecordId(workbookId, folder, filename);
      if (!recordId) {
        return true; // Strip unresolvable
      }
    }

    return false;
  }

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
