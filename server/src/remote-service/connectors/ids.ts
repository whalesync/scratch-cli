import { createPlainId } from '@spinner/shared-types';

/** The IDs we work on internally are used direclty in postgres and the UI and should be sane. */
// TODO(ryder): This doesn't check for uniqueness, so it will fail if two columns canonicalize to the same thing.
export function sanitizeForTableWsId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

const RESERVED_COLUMN_IDS = ['id', 'wsid', '__dirty', '__metadata', '__edited_fields', '__suggested_values'];

export function sanitizeForColumnWsId(id: string): string {
  const value = id.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

  // If the ID is a reserved word, add a suffix to make it unique
  if (RESERVED_COLUMN_IDS.includes(value)) {
    return `${value}_${createPlainId(3)}`;
  }

  return value;
}
