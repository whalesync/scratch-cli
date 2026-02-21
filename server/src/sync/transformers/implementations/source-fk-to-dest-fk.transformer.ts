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

    // Normalize scalar to array for uniform processing
    const isScalar = !Array.isArray(sourceValue);
    if (isScalar && typeof sourceValue !== 'string' && typeof sourceValue !== 'number') {
      return {
        success: false,
        error: `Expected string, number, or array for FK value, got ${typeof sourceValue}`,
      };
    }
    const elements: unknown[] = isScalar ? [sourceValue] : sourceValue;

    const resolved: string[] = [];
    for (const element of elements) {
      if (element === null || element === undefined) {
        continue;
      }
      if (typeof element !== 'string' && typeof element !== 'number') {
        return {
          success: false,
          error: `Expected string or number for FK array element, got ${typeof element}`,
        };
      }
      const fkStr = String(element);
      const destPath = await lookupTools.getDestinationPathForSourceFk(fkStr, typedOptions.referencedDataFolderId);
      if (destPath === null) {
        return {
          success: false,
          error: `Could not resolve foreign key "${fkStr}" to a destination path in DataFolder ${typedOptions.referencedDataFolderId}`,
        };
      }
      const pseudoRef = `@/${destPath}`;
      resolved.push(pseudoRef);
    }

    return { success: true, value: isScalar ? resolved[0] : resolved };
  },
};

// Auto-register on import
registerTransformer(sourceFkToDestFkTransformer);
