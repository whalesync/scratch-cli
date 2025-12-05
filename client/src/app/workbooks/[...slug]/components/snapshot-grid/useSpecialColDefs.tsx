import { ExistingChangeTypes } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { IdValueWrapper } from '@/app/components/field-value-wrappers/value/IdValueWrapper';
import { ID_COLUMN_FIELD } from '@/app/workbooks/[...slug]/components/snapshot-grid/ag-grid-constants';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { TableSpec } from '@/types/server-entities/workbook';
import { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';
import { IdHeaderComponent } from '../../../../components/field-value-wrappers/header/IdHeaderComponent';
import { getCellClassFn } from './useCellClass';

interface UseIdColDefProps {
  entityName: string;
  resizable?: boolean;
  gridApi?: GridApi<ProcessedSnapshotRecord> | null;
  recordDetailsVisible?: boolean;
  tableSpec: TableSpec;
  columnChangeTypes?: Record<string, ExistingChangeTypes>;
  onOpenOverlay?: (recordId: string) => void;
}

export const useSpecialColDefs = ({
  entityName,
  gridApi,
  columnChangeTypes,
  onOpenOverlay,
  recordDetailsVisible,
}: UseIdColDefProps) => {
  const idColumn: ColDef = {
    field: ID_COLUMN_FIELD,
    colId: ID_COLUMN_FIELD,
    headerName: entityName + 'ID',
    sortable: true,
    filter: false,
    resizable: true,
    pinned: 'left',
    lockPosition: true,
    width: 150,
    minWidth: 100,
    // Use custom ID header component with settings button
    headerComponent: IdHeaderComponent,
    headerComponentParams: {
      entityName,
      columnChangeTypes,
    },
    valueGetter: (params) => {
      return params.data?.id?.wsId || '';
    },
    cellRenderer: (params: ICellRendererParams<ProcessedSnapshotRecord, unknown>) => {
      return (
        <IdValueWrapper
          record={params.data}
          onOpenOverlay={onOpenOverlay && params.data?.id?.wsId ? () => onOpenOverlay(params.data!.id.wsId) : undefined}
          isOverlayOpen={recordDetailsVisible}
        />
      );
    },
    // cellStyle,
    cellClass: getCellClassFn({ gridApi, activeCells: null, columnId: 'id' }),
  };

  return { idColumn };
};
