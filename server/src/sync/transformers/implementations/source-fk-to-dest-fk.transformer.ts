import { SourceFkToDestFkOptions } from '@spinner/shared-types';
import { registerTransformer } from '../transformer-registry';
import { FieldTransformer, TransformContext, TransformResult } from '../transformer.types';

/**
 * Transforms a source foreign key ID to the corresponding destination foreign key ID.
 * Uses SyncRemoteIdMapping to resolve source FK values to destination IDs.
 *
 * Options:
 * - referencedDataFolderId: The source DataFolder ID of the referenced table mapping
 *
 * Handles scalars, arrays, and null/undefined values.
 */
export const sourceFkToDestFkTransformer: FieldTransformer = {
  type: 'source_fk_to_dest_fk',

  async transform(ctx: TransformContext): Promise<TransformResult> {
    // In DATA phase, skip transform: resolution happens in FOREIGN_KEY_MAPPING phase
    if (ctx.phase === 'DATA') {
      return { success: true, skip: true };
    }

    const { sourceValue, lookupTools, options } = ctx;
    const typedOptions = options as SourceFkToDestFkOptions;

    // Handle null/undefined
    if (sourceValue === null || sourceValue === undefined) {
      return { success: true, value: null };
    }

    // Handle arrays — resolve each element
    if (Array.isArray(sourceValue)) {
      const resolved: string[] = [];
      for (const element of sourceValue) {
        if (element === null || element === undefined) {
          continue;
        }
        const fkStr = String(element);
        const destId = await lookupTools.getDestinationIdForSourceFk(fkStr, typedOptions.referencedDataFolderId);
        if (destId === null) {
          return {
            success: false,
            error: `Could not resolve foreign key "${fkStr}" to a destination ID in DataFolder ${typedOptions.referencedDataFolderId}`,
          };
        }
        resolved.push(destId);
      }
      return { success: true, value: resolved };
    }

    // Handle scalar — coerce to string and resolve
    if (typeof sourceValue !== 'string' && typeof sourceValue !== 'number') {
      return {
        success: false,
        error: `Expected string, number, or array for FK value, got ${typeof sourceValue}`,
      };
    }
    const fkStr = String(sourceValue);
    const destId = await lookupTools.getDestinationIdForSourceFk(fkStr, typedOptions.referencedDataFolderId);
    if (destId === null) {
      return {
        success: false,
        error: `Could not resolve foreign key "${fkStr}" to a destination ID in DataFolder ${typedOptions.referencedDataFolderId}`,
      };
    }

    return { success: true, value: destId };
  },
};

// Auto-register on import
registerTransformer(sourceFkToDestFkTransformer);
