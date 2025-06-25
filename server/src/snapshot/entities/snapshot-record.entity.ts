import { EDITED_FIELDS_COLUMN, EditedFieldsMetadata } from '../snapshot-db.service';

export type SnapshotRecord = {
  /** RemoteID, which we also use as the primary key. */
  id: string;
  /** Which fields are dirty in the local copy of the record. */
  [EDITED_FIELDS_COLUMN]?: EditedFieldsMetadata;
} & { [wsId: string]: unknown };
