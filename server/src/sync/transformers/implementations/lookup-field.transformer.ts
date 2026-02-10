import { registerTransformer } from '../transformer-registry';
import { FieldTransformer, TransformResult } from '../transformer.types';

/**
 * Looks up a field value from a record referenced by a foreign key.
 * NOT YET IMPLEMENTED.
 */
export const lookupFieldTransformer: FieldTransformer = {
  type: 'lookup_field',

  transform(): Promise<TransformResult> {
    throw new Error('lookup_field transformer is not yet implemented');
  },
};

// Auto-register on import
registerTransformer(lookupFieldTransformer);
