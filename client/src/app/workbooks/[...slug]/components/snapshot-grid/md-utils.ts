import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import type { TableSpec } from '@spinner/shared-types';
import matter from 'gray-matter';

/**
 * Gets the main content column key from the table spec.
 * Uses mainContentColumnRemoteId if set, otherwise falls back to heuristics.
 */
export function getMainContentColumnKey(tableSpec: TableSpec): string | undefined {
  // First check if mainContentColumnRemoteId is set
  if (tableSpec.mainContentColumnRemoteId && tableSpec.mainContentColumnRemoteId.length > 0) {
    // Find the column with matching remoteId
    const column = tableSpec.columns.find(
      (col) =>
        tableSpec.mainContentColumnRemoteId?.includes(col.id.wsId) ||
        (col.id.remoteId && tableSpec.mainContentColumnRemoteId?.some((id) => col.id.remoteId?.includes(id))),
    );
    if (column) {
      return column.id.wsId;
    }
  }

  // Fallback to heuristics: find a suitable main content column
  const mainContentColumn = tableSpec.columns.find(
    (col) =>
      col.name.toLowerCase() === 'content' ||
      col.name.toLowerCase() === 'body' ||
      col.metadata?.textFormat === 'html' ||
      col.metadata?.textFormat === 'markdown',
  );

  return mainContentColumn?.id.wsId;
}

/**
 * Converts a record to Markdown with YAML front matter format.
 * Uses __fields (JSON representation) as the source of truth for the markdown view.
 * Uses the main content column (from mainContentColumnRemoteId) as the body content.
 */
export function recordToMdFm(record: ProcessedSnapshotRecord, tableSpec: TableSpec): string {
  // Use __fields if available, fallback to fields for backwards compatibility
  const fields = record.__fields || record.fields || {};
  const mainContentKey = getMainContentColumnKey(tableSpec);

  if (!mainContentKey) {
    // No main body key: all fields go to front matter, empty body
    return matter.stringify('', fields);
  }

  const { [mainContentKey]: body, ...rest } = fields;
  const bodyString =
    typeof body === 'string' ? body : body === null || body === undefined ? '' : JSON.stringify(body, null, 2);

  return matter.stringify(bodyString, rest);
}

/**
 * Parses Markdown with YAML front matter back to record fields.
 */
export function mdFmToFields(
  content: string,
  tableSpec: TableSpec,
): Record<string, string | number | boolean | null | undefined> {
  const parsed = matter(content);
  const meta = parsed.data as Record<string, unknown>;
  const mainContentKey = getMainContentColumnKey(tableSpec);

  if (!mainContentKey) {
    return meta as Record<string, string | number | boolean | null | undefined>;
  }

  return {
    ...meta,
    [mainContentKey]: parsed.content ?? '',
  } as Record<string, string | number | boolean | null | undefined>;
}

/**
 * Parses a dropped MD file content into fields for creating a new record.
 * Returns all fields from the front matter plus the body content.
 * Works with both schema fields and extra fields (which will go to __fields).
 */
export function parseMdFileForNewRecord(content: string, tableSpec: TableSpec): Record<string, unknown> {
  const parsed = matter(content);
  const meta = parsed.data as Record<string, unknown>;
  const mainContentKey = getMainContentColumnKey(tableSpec);

  // Start with all front matter fields (may include extra fields not in schema)
  const fields: Record<string, unknown> = { ...meta };

  // Add body content to the main content column if one exists
  if (mainContentKey && parsed.content) {
    fields[mainContentKey] = parsed.content;
  }

  return fields;
}
