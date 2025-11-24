// Design!
// There isn't a system yet for tracking versions of edits that are made to the snapshot, so instead, we use a column
// of metadata in each snapshotted table. It contains the fields that have been edited since last download, plus whether
// the record was created or deleted.
export const EDITED_FIELDS_COLUMN = '__edited_fields';
// Same as the above, but for edits that are suggested by the AI.
export const SUGGESTED_FIELDS_COLUMN = '__suggested_values';
// Connector specific optional per record metadata
export const METADATA_COLUMN = '__metadata';

export const DIRTY_COLUMN = '__dirty';

// A special field that is used to mark a record as deleted in the EDITED_FIELDS_COLUMN and SUGGESTED_FIELDS_COLUMN
export const DELETED_FIELD = '__deleted';

export const SEEN_COLUMN = '__seen';
export const CREATED_FIELD = '__created';
