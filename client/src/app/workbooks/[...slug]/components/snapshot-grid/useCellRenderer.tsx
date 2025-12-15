import { ExistingChangeTypes } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { FieldValueWrapper } from '@/app/components/field-value-wrappers/value/FieldValueWrapper';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/workbook';
import { ICellRendererParams } from 'ag-grid-community';
// Custom cell renderer with diff support for suggested values

export interface FirstSuggestionCell {
  recordId: string;
  columnId: string;
}

export const useCellRenderer = (
  table: TableSpec,
  columnChangeTypes: Record<string, ExistingChangeTypes>,
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>,
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>,
  onboardingSuggestionsCell?: FirstSuggestionCell | null,
  recordDetailsOpen?: boolean,
) => {
  type TValue = unknown;
  type TContext = unknown;
  const cellRenderer = (params: ICellRendererParams<SnapshotRecord, TValue, TContext>): React.ReactNode => {
    // Find the column definition to get the column info
    const columnDef = table.columns.find((col) => col.id.wsId === params.colDef?.field);
    const record = params.data as ProcessedSnapshotRecord;

    const columnHasChanges =
      columnDef &&
      columnChangeTypes[columnDef.id.wsId] &&
      (columnChangeTypes[columnDef.id.wsId].suggestedAdditions ||
        columnChangeTypes[columnDef.id.wsId].suggestedDeletions ||
        columnChangeTypes[columnDef.id.wsId].acceptedAdditions ||
        columnChangeTypes[columnDef.id.wsId].acceptedDeletions);

    // Check if this is the first cell with a suggestion
    const isOnboardingSuggestionsCell =
      onboardingSuggestionsCell &&
      record?.id?.wsId === onboardingSuggestionsCell.recordId &&
      columnDef?.id.wsId === onboardingSuggestionsCell.columnId;

    return (
      <FieldValueWrapper
        columnDef={columnDef!}
        record={record}
        showSuggestionButtons={true}
        showChangeIndicators={!!columnHasChanges}
        acceptCellValues={acceptCellValues}
        rejectCellValues={rejectCellValues}
        showOnboardingTooltip={!!isOnboardingSuggestionsCell && !recordDetailsOpen}
      />
    );
  };
  return { cellRenderer };
};
