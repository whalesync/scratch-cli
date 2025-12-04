// Core identity columns
export const REMOTE_ID_COLUMN = '__remoteId';
export const SCRATCH_ID_COLUMN = '__scratchId';
export const OLD_REMOTE_ID_COLUMN = '__old_remote_id';

// Json meta fields
// Design!
// There isn't a system yet for tracking versions of edits that are made to the snapshot, so instead, we use a column
// of metadata in each snapshotted table. It contains the fields that have been edited since last download, plus whether
// the record was created or deleted.
export const EDITED_FIELDS_COLUMN = '__edited_fields';
// Same as the above, but for edits that are suggested by the AI.
export const SUGGESTED_FIELDS_COLUMN = '__suggested_values';
// Connector specific optional per record metadata
export const METADATA_COLUMN = '__metadata';
export const ORIGINAL_COLUMN = '__original';

// Flags
export const DIRTY_COLUMN = '__dirty';
export const SEEN_COLUMN = '__seen';

// A special field that is used to mark a record as deleted in the EDITED_FIELDS_COLUMN and SUGGESTED_FIELDS_COLUMN
export const DELETED_FIELD = '__deleted';
export const CREATED_FIELD = '__created';

// Special remoteId values:
export const UNPUBLISHED_PREFIX = 'unpublished_';
export const DELETED_PREFIX = 'deleted_';
