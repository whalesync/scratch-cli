import * as posixPath from 'path/posix';

import { SnapshotTableCluster, WorkbookCluster } from 'src/db/cluster-types';
import { AnyTableSpec } from 'src/remote-service/connectors/library/custom-spec-registry';

/**
 * Get snapshot table by its ID (recommended)
 */
export function getSnapshotTableById(
  workbook: WorkbookCluster.Workbook,
  tableId: string,
): SnapshotTableCluster.SnapshotTable | undefined {
  return workbook.snapshotTables?.find((t) => t.id === tableId);
}

/**
 * Get table spec by snapshot table ID (recommended)
 */
export function getTableSpecById(workbook: WorkbookCluster.Workbook, tableId: string): AnyTableSpec | undefined {
  const snapshotTable = getSnapshotTableById(workbook, tableId);
  if (!snapshotTable) {
    return undefined;
  }
  return snapshotTable.tableSpec as AnyTableSpec;
}

/**
 * @deprecated Use getSnapshotTableById instead. This function uses the old wsId from tableSpec.
 */
export function getSnapshotTableByWsId(
  workbook: WorkbookCluster.Workbook,
  wsId: string,
): SnapshotTableCluster.SnapshotTable | undefined {
  return workbook.snapshotTables?.find((t) => (t.tableSpec as AnyTableSpec).id.wsId === wsId);
}

/**
 * @deprecated Use getTableSpecById instead. This function uses the old wsId from tableSpec.
 */
export function getTableSpecByWsId(workbook: WorkbookCluster.Workbook, wsId: string): AnyTableSpec | undefined {
  const snapshotTable = getSnapshotTableByWsId(workbook, wsId);
  if (!snapshotTable) {
    return undefined;
  }
  return snapshotTable.tableSpec as AnyTableSpec;
}

/**
 * @param filename - name of the file to slugify
 * @returns a version of the file name that is safe to use as a file name
 */
export function normalizeFileName(filename: string): string {
  return filename
    .toString() // Ensure the input is a string
    .normalize('NFD') // Split accented letters into base letter and accent
    .replace(/[\u0300-\u036f]/g, '') // Remove all previously split accents (diacritical marks)
    .toLowerCase() // Convert to lowercase
    .trim() // Trim leading/trailing whitespace
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9 -]/g, '') // Remove all non-alphanumeric characters, except hyphens and spaces
    .replace(/-+/g, '-'); // Replace multiple hyphens with a single hyphen
}

/**
 * @param name - name of the folder to normalize
 * @returns a version of the folder name that is safe to use as a folder name in a path
 */
export function normalizeFolderName(name: string): string {
  return name.toString().replace(/\//g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract the filename from a POSIX path.
 * @param path - a POSIX-style file path (e.g. "/folder/subfolder/file.txt")
 * @returns the filename portion of the path (e.g. "file.txt")
 */
export function extractFilenameFromPath(path: string): string {
  return posixPath.basename(path);
}

/**
 * Resolves the preferred base filename (without extension) for a record.
 * Priority: slug value > title value > ID value.
 * Slug and title values are run through normalizeFileName for safety.
 */
export function resolveBaseFileName(options: {
  slugValue?: string | null;
  titleValue?: string | null;
  idValue: string;
}): string {
  if (options.slugValue && typeof options.slugValue === 'string' && options.slugValue.trim()) {
    return normalizeFileName(options.slugValue);
  }
  if (options.titleValue && typeof options.titleValue === 'string' && options.titleValue.trim()) {
    return normalizeFileName(options.titleValue);
  }
  return options.idValue;
}

/**
 * Ensures a filename is unique within a set of existing names.
 * If the candidate collides, appends the record's ID as a deterministic suffix.
 * Adds the final name to the existingNames set.
 */
export function deduplicateFileName(
  baseName: string,
  extension: string,
  existingNames: Set<string>,
  recordId: string,
): string {
  let candidate = baseName + extension;
  if (existingNames.has(candidate)) {
    candidate = `${baseName}-${recordId}${extension}`;
  }
  existingNames.add(candidate);
  return candidate;
}

export function assertFolderPathIsValid(path: unknown): asserts path is string {
  if (typeof path !== 'string') {
    throw new Error(`Path must be a string, but got ${typeof path}: ${path as string}`);
  }
  if (path.length === 0) {
    throw new Error('Path must not be empty');
  }
  if (!path.startsWith('/')) {
    throw new Error('Path must start with a slash');
  }
}
