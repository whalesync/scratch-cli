import { AG } from '@/app/snapshots/[...slug]/components/new-snapshot-table/ag-grid-constants';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { Box, Text, useMantineColorScheme } from '@mantine/core';
import { CellStyleFunc, ColDef, ICellRendererParams } from 'ag-grid-community';
import { IdHeaderComponent } from './IdHeaderComponent';

interface UseIdColDefProps {
  onSettingsClick: () => void;
  resizable?: boolean;
}

export const useSpecialColDefs = ({ onSettingsClick, resizable = true }: UseIdColDefProps) => {
  const { colorScheme } = useMantineColorScheme();
  const isLightMode = colorScheme === 'light';
  const cellStyle: CellStyleFunc<SnapshotRecord, unknown> = () => {
    const colors = isLightMode ? AG.colors.light : AG.colors.dark;
    const baseStyles = {
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
    // pinned: 'left',
    lockPosition: true,
    // suppressMovable: true,
    width: 150,
    minWidth: 150,
    maxWidth: 150,
    // Use custom ID header component with settings button
    headerComponent: IdHeaderComponent,
    headerComponentParams: {
      onSettingsClick,
    },
    valueGetter: (params) => {
      return params.data?.id?.wsId || '';
    },
    cellRenderer: (params: ICellRendererParams<SnapshotRecord, unknown>) => {
      const value = params.value;
      return (
        <Box display="flex" h="100%" style={{ alignItems: 'center' }}>
          <Text>{String(value)}</Text>
        </Box>
      );
    },
    cellStyle,
  };

  const dotColumn: ColDef = {
    field: '',
    headerName: 'dot',
    sortable: true,
    filter: false,
    resizable: resizable,
    pinned: 'left',
    lockPosition: true,
    // suppressMovable: true,
    width: 22,
    minWidth: 22,
    maxWidth: 22,
    cellStyle: () => {
      return {
        padding: 5,
      };
    },
    valueGetter: () => '',
    headerComponent: null,
    cellRenderer: (params: ICellRendererParams<SnapshotRecord, unknown>) => {
      // const value = params.value;
      const record = params.data as SnapshotRecord;

      // Check if there are any edited fields for this record
      const hasEditedFields = record?.__edited_fields && Object.keys(record.__edited_fields).length > 0;
      const colors = isLightMode ? AG.colors.light : AG.colors.dark;

      return (
        <Box display="flex" h="100%" style={{ alignItems: 'center', justifyContent: 'center' }}>
          {hasEditedFields ? (
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: colors.diffAdded,
                flexShrink: 0,
              }}
            />
          ) : (
            <div style={{ width: '8px', height: '8px', flexShrink: 0 }} />
          )}
        </Box>
      );
    },
  };
  return { idColumn, dotColumn };
};
