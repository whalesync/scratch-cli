import { registerTransformer } from '../transformer-registry';
import { FieldTransformer, TransformResult } from '../transformer.types';

/**
 * Transforms a source foreign key ID to the corresponding destination foreign key ID.
 * NOT YET IMPLEMENTED.
 */
export const sourceFkToDestFkTransformer: FieldTransformer = {
  type: 'source_fk_to_dest_fk',

  transform(): Promise<TransformResult> {
    throw new Error('source_fk_to_dest_fk transformer is not yet implemented');
  },
};

// Auto-register on import
registerTransformer(sourceFkToDestFkTransformer);
