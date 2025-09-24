import { DiffText } from '@/app/components/DiffText';
import { SnapshotRecord, TableSpec, formatFieldValue } from '@/types/server-entities/snapshot';
import { Box, Text } from '@mantine/core';
import { ICellRendererParams } from 'ag-grid-community';
// Custom cell renderer with diff support for suggested values

export const useCellRenderer = (table: TableSpec) => {
  // const { colorScheme } = useMantineColorScheme();
  // const isLightMode = colorScheme === 'light';

  type TValue = unknown;
  type TContext = unknown;
  const cellRenderer = (params: ICellRendererParams<SnapshotRecord, TValue, TContext>): React.ReactNode => {
    const value = params.value;

    // Find the column definition to get the column info
    const columnDef = table.columns.find((col) => col.id.wsId === params.colDef?.field);
    if (!columnDef) {
      return (
        <Box
          display="flex"
          h="100%"
          style={{ alignItems: 'center', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}
        >
          <Text className="cell-text">{String(value)}</Text>
        </Box>
      );
    }

    const formattedValue = formatFieldValue(value, columnDef);

    // Access suggested values directly from the record data
    const record = params.data as SnapshotRecord;
    const suggestedValue = record?.__suggested_values?.[columnDef.id.wsId];
    // const colors = isLightMode ? AG.colors.light : AG.colors.dark;
    if (suggestedValue) {
      // If there's no existing value, just show the suggested value
      if (!formattedValue || formattedValue === '' || formattedValue === 'null' || formattedValue === 'undefined') {
        return (
          <Box
            display="flex"
            h="100%"
            style={{ alignItems: 'center', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}
          >
            <Text
              className="cell-text" // css class for the text in the cell
            >
              {String(suggestedValue)}
            </Text>
          </Box>
        );
      }

      // Use diff to show changes when there's both existing and suggested values
      // const changes = diffWordsWithSpace(formattedValue, String(suggestedValue));

      return (
        <Box
          display="flex"
          h="100%"
          style={{ alignItems: 'center', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}
        >
          <DiffText originalValue={formattedValue} suggestedValue={String(suggestedValue)} />
        </Box>
      );
    }

    return (
      <Box
        className="cell-box" // css class for the text in the cell
        display="flex"
        h="100%"
        style={{ alignItems: 'center', overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}
      >
        <Text className="cell-text">{formattedValue}</Text>
      </Box>
    );
  };
  return { cellRenderer };
};
