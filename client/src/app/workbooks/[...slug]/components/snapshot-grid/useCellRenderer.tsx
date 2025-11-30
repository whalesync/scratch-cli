import { FieldValueWrapper } from '@/app/components/field-value-wrappers/FieldValueWrapper';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/workbook';
import { ICellRendererParams } from 'ag-grid-community';
// Custom cell renderer with diff support for suggested values

export const useCellRenderer = (
  table: TableSpec,
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>,
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>,
) => {
  type TValue = unknown;
  type TContext = unknown;
  const cellRenderer = (params: ICellRendererParams<SnapshotRecord, TValue, TContext>): React.ReactNode => {
    const value = params.value;

    // Find the column definition to get the column info
    const columnDef = table.columns.find((col) => col.id.wsId === params.colDef?.field);
    const record = params.data as SnapshotRecord;

    return (
      <FieldValueWrapper
        value={value}
        columnDef={columnDef!}
        record={record}
        showSuggestionButtons={true}
        acceptCellValues={acceptCellValues}
        rejectCellValues={rejectCellValues}
      />
    );
  };
  return { cellRenderer };
};
