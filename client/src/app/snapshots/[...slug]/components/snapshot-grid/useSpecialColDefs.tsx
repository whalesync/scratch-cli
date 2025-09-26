import { AG } from '@/app/snapshots/[...slug]/components/snapshot-grid/ag-grid-constants';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { Box, Text, Tooltip, useMantineColorScheme } from '@mantine/core';
import { CellStyleFunc, ColDef, GridApi, ICellRendererParams } from 'ag-grid-community';
import { IdHeaderComponent } from './IdHeaderComponent';

interface UseIdColDefProps {
  onSettingsClick: () => void;
  resizable?: boolean;
  gridApi?: GridApi<SnapshotRecord> | null;
  recordDetailsVisible?: boolean;
}

export const useSpecialColDefs = ({
  onSettingsClick,
  resizable = true,
  gridApi,
  recordDetailsVisible,
}: UseIdColDefProps) => {
  const { colorScheme } = useMantineColorScheme();
  const isLightMode = colorScheme === 'light';
  const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = () => {
    const colors = isLightMode ? AG.colors.light : AG.colors.dark;

    // Check if this cell is in the same column as the focused cell
    const focusedCell = gridApi?.getFocusedCell();
    const isInFocusedColumn = focusedCell && !recordDetailsVisible && focusedCell.column.getColId() === 'id';

    const backgroundColor = isInFocusedColumn
      ? isLightMode
        ? 'var(--mantine-color-gray-4)'
        : 'var(--mantine-color-gray-7)'
      : 'transparent';

    const baseStyles = {
      backgroundColor,
      paddingLeft: AG.borders.paddingLeft,
      color: colors.readOnlyText, // ID column is always read-only
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
    resizable: resizable,
    // cellClass: idCellClass,
    // pinned: 'left',
    // lockPosition: true,
    // suppressMovable: true,
    width: 150,
    minWidth: 150,
    maxWidth: 150,
    // Use custom ID header component with settings button
    headerComponent: IdHeaderComponent,
    headerComponentParams: {
      onSettingsClick,
    },
    // valueGetter: (params) => {
    //   return params.data?.id?.wsId || '';
    // },
    cellRenderer: (params: ICellRendererParams<SnapshotRecord, unknown>) => {
      // const value = params.value;
      return (
        <Box display="flex" h="100%" style={{ alignItems: 'center' }}>
          <Text className="cell-text">{String(params.data?.id?.wsId)}</Text>
        </Box>
      );
    },
    cellStyle,
  };

  const dotColumn: ColDef = {
    field: '',
    headerName: '',
    sortable: true,
    filter: false,
    resizable: resizable,
    pinned: 'left',
    lockPosition: true,
    // suppressMovable: true,
    width: 22,
    minWidth: 22,
    maxWidth: 22,
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
