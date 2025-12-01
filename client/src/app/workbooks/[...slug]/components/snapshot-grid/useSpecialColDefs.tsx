import { ExistingChangeTypes } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { IdValueWrapper } from '@/app/components/field-value-wrappers/value/IdValueWrapper';
import { AG, ID_COLUMN_FIELD } from '@/app/workbooks/[...slug]/components/snapshot-grid/ag-grid-constants';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/workbook';
import { Box, Tooltip, useMantineColorScheme } from '@mantine/core';
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
  resizable = true,
  gridApi,
  columnChangeTypes,
  onOpenOverlay,
  recordDetailsVisible,
}: UseIdColDefProps) => {
  const { colorScheme } = useMantineColorScheme();
  const isLightMode = colorScheme === 'light';

  const idColumn: ColDef = {
    field: ID_COLUMN_FIELD,
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

  const dotColumn: ColDef = {
    field: '',
    headerName: '',
    sortable: false,
    filter: false,
    resizable: resizable,
    pinned: 'left',
    lockPosition: true,
    // suppressMovable: true,
    width: AG.dotColumn.width,
    minWidth: AG.dotColumn.width,
    maxWidth: AG.dotColumn.width,
    cellStyle: (params) => {
      const record = params.data as SnapshotRecord;
      const isDeleted = record?.__edited_fields?.__deleted;

      return {
        padding: 5,
        backgroundColor: isDeleted ? (isLightMode ? '#fde0e0' : '#4a1a1a') : 'transparent',
      };
    },
    valueGetter: () => '',
    headerComponent: null,
    cellRenderer: (params: ICellRendererParams<SnapshotRecord, unknown>) => {
      // const value = params.value;
      const record = params.data as SnapshotRecord;

      // Check if there are any edited fields for this record
      const hasEditedFields = record?.__edited_fields && Object.keys(record.__edited_fields).length > 0;

      return (
        <Box display="flex" h="100%" style={{ alignItems: 'center', justifyContent: 'center' }}>
          {hasEditedFields ? (
            <Tooltip label="This record contains unpublished changes" position="top" withArrow>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-suggestion-9)',
                  flexShrink: 0,
                  cursor: 'help',
                }}
              />
            </Tooltip>
          ) : (
            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
          )}
        </Box>
      );
    },
  };
  return { idColumn, dotColumn };
};
