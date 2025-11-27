import { IdValueWrapper } from '@/app/components/field-value-wrappers/IdValueWrapper';
import { AG, ID_COLUMN_FIELD } from '@/app/workbooks/[...slug]/components/snapshot-grid/ag-grid-constants';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/workbook';
import { Box, Tooltip, useMantineColorScheme } from '@mantine/core';
import { ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';
import { IdHeaderComponent } from './IdHeaderComponent';
import { getCellClassFn } from './useCellClass';

interface UseIdColDefProps {
  entityName: string;
  resizable?: boolean;
  gridApi?: GridApi<SnapshotRecord> | null;
  recordDetailsVisible?: boolean;
  tableSpec: TableSpec;
}

export const useSpecialColDefs = ({ entityName, resizable = true, gridApi }: UseIdColDefProps) => {
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
    },
    valueGetter: (params) => {
      return params.data?.id?.wsId || '';
    },
    cellRenderer: (params: ICellRendererParams<SnapshotRecord, unknown>) => {
      return <IdValueWrapper record={params.data} />;
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
