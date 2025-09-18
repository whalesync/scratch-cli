import { AG } from '@/app/snapshots/[...slug]/components/new-snapshot-table/ag-grid-constants';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { CellStyleFunc, ColDef, ICellRendererParams } from 'ag-grid-community';
export const useIdColDef = () => {
  const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = () => {
    const baseStyles = {
      background: `linear-gradient(to right, ${AG.colors.outerBorder} 0px, ${AG.colors.outerBorder} ${AG.borders.outerBorderWidth}, transparent ${AG.borders.outerBorderWidth})`,
      backgroundSize: `${AG.borders.outerBorderWidth} ${AG.borders.outerBorderHeight}`,
      backgroundPosition: 'left center',
      backgroundRepeat: 'no-repeat',
      paddingLeft: AG.borders.paddingLeft,
      color: AG.colors.readOnlyText, // ID column is always read-only
      fontWeight: '500',
    };
    return baseStyles;
  };
  // Create ID column as first locked column
  const idColumn: ColDef = {
    field: 'id',
    headerName: 'ID',
    sortable: true,
    filter: false,
    resizable: true,
    pinned: 'left',
    lockPinned: true,
    width: 150,
    minWidth: 150,
    maxWidth: 150,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    valueGetter: (params: any) => {
      return params.data?.id?.wsId || '';
    },
    cellRenderer: (params: ICellRendererParams<SnapshotRecord, unknown>) => {
      const value = params.value;
      const record = params.data as SnapshotRecord;

      // Check if there are any suggestions for this record
      const hasSuggestions = record?.__suggested_values && Object.keys(record.__suggested_values).length > 0;

      if (value === null || value === undefined) {
        return hasSuggestions ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: AG.colors.diffAdded,
                flexShrink: 0,
              }}
            />
            <span></span>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
            <span></span>
          </div>
        );
      }

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {hasSuggestions ? (
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: AG.colors.diffAdded,
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
          )}
          <span>{String(value)}</span>
        </div>
      );
    },
    cellStyle,
  };
  return { idColumn };
};
