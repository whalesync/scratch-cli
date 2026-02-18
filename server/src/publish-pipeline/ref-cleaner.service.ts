import { Injectable } from '@nestjs/common';

import { ParsedContent, Schema } from 'src/utils/objects';
import { FileIndexService } from './file-index.service';
import { parsePath } from './utils';

export type StripMode = 'ALL' | 'IDS_ONLY' | 'PSEUDO_ONLY';

@Injectable()
export class RefCleanerService {
  constructor(private readonly fileIndexService: FileIndexService) {}
  /**
   * Strip references that point to any of the paths in the set or are unresolvable pseudo-refs.
   * Returns a deep copy of content with matching refs replaced by null.
   */
  async stripReferencesWithSchema(
    workbookId: string,
    content: ParsedContent,
    schema: Schema | null,
    addedPaths: Set<string>,
    idsToStrip?: Set<string>,
    mode: StripMode = 'ALL',
  ): Promise<ParsedContent> {
    if (!content || !schema) return content;

    // Deep copy to avoid mutating original
    const result = structuredClone(content);

    // 1. Find all FK paths in the schema
    const fkPaths = this.extractForeignKeyPaths(schema);

    for (const fk of fkPaths) {
      // 2. Get nodes at this path in the content
      // We need to modify them in place, so getNodesByPath might not be enough if it returns values.
      // We'll write a specific traverser that can update values.
      await this.stripAtNodes(workbookId, result, fk.path, addedPaths, idsToStrip, mode);
    }

    return result;
  }

  /**
   * Traverses the schema to find all paths that are marked as foreign keys.
   */
  extractForeignKeyPaths(schema: Schema): Array<{ path: string[]; targetFolderId: string; map?: string }> {
    const results: Array<{ path: string[]; targetFolderId: string; map?: string }> = [];

    const walk = (schemaNode: any, currentPath: string[]) => {
      if (!schemaNode || typeof schemaNode !== 'object') return;

      // Check for x-scratch-foreign-key
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const foreignKey = schemaNode['x-scratch-foreign-key'];

      if (foreignKey) {
        let linkedTableId: string | undefined;
        let map: string | undefined;

        if (typeof foreignKey === 'string') {
          linkedTableId = foreignKey;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        } else if (typeof foreignKey === 'object' && foreignKey.linkedTableId) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          linkedTableId = foreignKey.linkedTableId;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (schemaNode.properties) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        for (const [key, prop] of Object.entries(schemaNode.properties)) {
          walk(prop, [...currentPath, key]);
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (schemaNode.items) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (Array.isArray(schemaNode.items)) {
          // tuple validation not supported for now in this simple walker
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          walk(schemaNode.items, [...currentPath, '[]']);
        }
      }

      // Handle oneOf, anyOf, allOf (common in Webflow schemas)
      // These do NOT increase the data path depth.
      const combinators = ['oneOf', 'anyOf', 'allOf'];
      for (const comb of combinators) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (Array.isArray(schemaNode[comb])) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          for (const subSchema of schemaNode[comb]) {
            walk(subSchema, currentPath);
          }
        }
      }
    };

    walk(schema, []);
    return results;
  }

  // Helper to traverse and strip at specific path
  private async stripAtNodes(
    workbookId: string,
    root: any,
    path: string[],
    addedPaths: Set<string>,
    idsToStrip?: Set<string>,
    mode: StripMode = 'ALL',
  ): Promise<void> {
    if (!root) return;
    if (path.length === 0) return;

    const [head, ...tail] = path;

    if (head === '[]') {
      if (Array.isArray(root)) {
        for (let i = 0; i < root.length; i++) {
          if (tail.length === 0) {
            // Reached the leaf node (FK value) inside array
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            root[i] = await this.checkAndStrip(workbookId, root[i], addedPaths, idsToStrip, mode);
          } else {
            await this.stripAtNodes(workbookId, root[i], tail, addedPaths, idsToStrip, mode);
          }
        }
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (root[head] !== undefined) {
        if (tail.length === 0) {
          // Reached the leaf node (FK value)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          root[head] = await this.checkAndStrip(workbookId, root[head], addedPaths, idsToStrip, mode);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          await this.stripAtNodes(workbookId, root[head], tail, addedPaths, idsToStrip, mode);
        }
      }
    }
  }

  private async checkAndStrip(
    workbookId: string,
    value: any,
    addedPaths: Set<string>,
    idsToStrip?: Set<string>,
    mode: StripMode = 'ALL',
  ): Promise<any> {
    // Helper to check a single value (string or array of strings)
    // Actually schema usually points to the specific field.
    // Multiref might be an array of strings.

    if (Array.isArray(value)) {
      const newArray = [];
      for (const item of value) {
        const stripped = await this.shouldStrip(workbookId, item, addedPaths, idsToStrip, mode);
        if (!stripped) newArray.push(item);
      }
      return newArray;
    } else {
      const stripped = await this.shouldStrip(workbookId, value, addedPaths, idsToStrip, mode);
      return stripped ? null : value;
    }
  }

  private async shouldStrip(
    workbookId: string,
    value: any,
    addedPaths: Set<string>,
    idsToStrip?: Set<string>,
    mode: StripMode = 'ALL',
  ): Promise<boolean> {
    if (typeof value !== 'string') return false;

    // Check 0: Is it in idsToStrip? (Only if mode is ALL or IDS_ONLY)
    if (mode === 'ALL' || mode === 'IDS_ONLY') {
      if (idsToStrip && idsToStrip.has(value)) {
        return true;
      }
    }

    // Check 1: Is it a pseudo-ref? (Only if mode is ALL or PSEUDO_ONLY)
    if (mode === 'ALL' || mode === 'PSEUDO_ONLY') {
      if (value.startsWith('@/')) {
        const targetPath = value.substring(2);

        // If it points to an added file, STRIP IT.
        // (Normalize check: targetPath matching addedPaths)
        if (addedPaths.has(targetPath) || addedPaths.has('/' + targetPath)) {
          return true;
        }

        // If it points to a file that DOES NOT EXIST in FileIndex, STRIP IT.
        const { folderPath: folder, filename } = parsePath(targetPath);

        const recordId = await this.fileIndexService.getRecordId(workbookId, folder, filename);
        if (!recordId) {
          return true; // Strip unresolvable
        }
      }
    }

    return false;
  }
}
