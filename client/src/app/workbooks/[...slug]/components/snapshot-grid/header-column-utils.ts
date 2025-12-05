/**
 * The server can optionally specify which column is the header/title column via titleColumnRemoteId.
 * When set, this is used as the primary identifier for records in the UI.
 *
 * Many services define this:
 * - For CSV this picked by the user when the snapshot is being created
 * - For Notion this is the name column
 * - For youtube it is the video title
 * - For Airtable it is the 1st column (or we can make this configurable)
 *
 * When titleColumnRemoteId is not set, we fall back to pattern matching (looking for 'title' or 'name' columns).
 * For other services, the user may pick the header column when the snapshot is being created (e.g., git sync).
 */

import { ColumnSpec, TableSpec } from '@/types/server-entities/workbook';

const commonTitleColumnPatterns = ['title', 'name'];

export function identifyRecordTitleColumn(table: TableSpec): string {
  // If titleColumnRemoteId is explicitly set in the spec, use it
  if (table.titleColumnRemoteId) {
    // Find the column with matching remoteId
    const titleColumn = table.columns.find(
      (col) =>
        col.id.remoteId.length === table.titleColumnRemoteId!.length &&
        col.id.remoteId.every((val, idx) => val === table.titleColumnRemoteId![idx]),
    );
    if (titleColumn) {
      return titleColumn.id.wsId;
    }
  }

  // Fall back to checking for common title column patterns
  for (const column of table.columns) {
    if (
      commonTitleColumnPatterns.includes(column.name.toLowerCase()) ||
      commonTitleColumnPatterns.includes(column.id.wsId.toLowerCase())
    ) {
      return column.id.wsId;
    }
  }
  // If no title column is found, return the first column that isn't the ID column
  return table.columns.find((column) => column.id.wsId !== 'id')?.id.wsId ?? table.columns[0].id.wsId;
}

function findTitleColumn(table: TableSpec, hiddenColumns: string[]): ColumnSpec | undefined {
  let found: ColumnSpec | undefined;
  // If titleColumnRemoteId is explicitly set in the spec, use it
  if (table.titleColumnRemoteId) {
    found = table.columns.find(
      (col) =>
        col.id.remoteId.length === table.titleColumnRemoteId!.length &&
        col.id.remoteId.every((val, idx) => val === table.titleColumnRemoteId![idx]),
    );
  }
  if (!found) {
    // Fall back to checking for common title column patterns
    found = table.columns.find((col) => commonTitleColumnPatterns.includes(col.name.toLowerCase()));
  }

  if (found && hiddenColumns.includes(found.id.wsId)) {
    return undefined;
  }
  return found;
}

/**
 * All columns that should be displayed in the grid.
 * If there is a title column, it is ordered first.
 */
export function getGridOrderedColumnSpecs(
  table: TableSpec,
  hiddenColumns: string[],
): { columns: ColumnSpec[]; titleColumnId: string | undefined } {
  const title = findTitleColumn(table, hiddenColumns);
  const columns = title ? [title] : [];
  columns.push(
    ...table.columns.filter((col) => !hiddenColumns.includes(col.id.wsId) && col.id.wsId !== title?.id.wsId),
  );
  return { columns, titleColumnId: title?.id?.wsId };
}
