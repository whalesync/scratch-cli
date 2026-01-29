import { CREATED_FIELD, DELETED_FIELD } from '@spinner/shared-types';

/**
 * @deprecated This code only exist to keep the connector code compiling. Once that connector code is refactored, this type can be removed.
 */
export type EditedFieldsMetadata = {
  /** Timestamps when the record was created locally. */
  [CREATED_FIELD]?: string;
  /** Timestamps when the record was deleted locally. */
  [DELETED_FIELD]?: string;
} & {
  /** The fields that have been edited since last download */
  [wsId: string]: string;
};
