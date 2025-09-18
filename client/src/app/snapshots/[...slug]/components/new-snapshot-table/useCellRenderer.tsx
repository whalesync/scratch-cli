import { AG } from '@/app/snapshots/[...slug]/components/new-snapshot-table/ag-grid-constants';
import { SnapshotRecord, TableSpec, formatFieldValue } from '@/types/server-entities/snapshot';
import { ICellRendererParams } from 'ag-grid-community';
import { diffWordsWithSpace } from 'diff';
// Custom cell renderer with diff support for suggested values

export const useCellRenderer = (table: TableSpec) => {
  type TValue = unknown;
  type TContext = unknown;
  const cellRenderer = (params: ICellRendererParams<SnapshotRecord, TValue, TContext>): React.ReactNode => {
    const value = params.value;
    // if (value === null || value === undefined) {
    //   return '';
    // }

    // Find the column definition to get the column info
    const columnDef = table.columns.find((col) => col.id.wsId === params.colDef?.field);
    if (!columnDef) {
      return String(value);
    }

    const formattedValue = formatFieldValue(value, columnDef);

    // Access suggested values directly from the record data
    const record = params.data as SnapshotRecord;
    const suggestedValue = record?.__suggested_values?.[columnDef.id.wsId];

    if (suggestedValue) {
      // if (Date.now() > 0) {
      //   return 'a';
      // }
      // If there's no existing value, just show the suggested value
      if (!formattedValue || formattedValue === '' || formattedValue === 'null' || formattedValue === 'undefined') {
        return (
          <span
            style={{
              color: AG.colors.diffAdded,
              // fontWeight: 'bold',
              backgroundColor: AG.colors.diffAddedBg,
              padding: '1px 2px',
            }}
          >
            {String(suggestedValue)}
          </span>
        );
      }

      // Use diff to show changes when there's both existing and suggested values
      const changes = diffWordsWithSpace(formattedValue, String(suggestedValue));

      return (
        <span>
          {changes.map((change, idx) => {
            if (change.added) {
              return (
                <span
                  key={idx}
                  style={{
                    color: AG.colors.diffAdded,
                    // fontWeight: 'bold',
                    backgroundColor: AG.colors.diffAddedBg,
                    padding: '1px 2px',
                    marginLeft: '1px',
                  }}
                >
                  {change.value}
                </span>
              );
            }
            if (change.removed) {
              return (
                <span
                  key={idx}
                  style={{
                    color: AG.colors.diffRemoved,
                    textDecoration: 'line-through',
                    backgroundColor: AG.colors.diffRemovedBg,
                    padding: '1px 2px',
                    marginRight: '1px',
                  }}
                >
                  {change.value}
                </span>
              );
            }
            return <span key={idx}>{change.value}</span>;
          })}
        </span>
      );
    }

    return formattedValue;
  };
  return { cellRenderer };
};
