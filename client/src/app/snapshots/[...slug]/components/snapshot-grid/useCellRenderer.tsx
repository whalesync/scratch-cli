import { DiffText2 } from '@/app/components/DiffText2';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord, TableSpec, formatFieldValue } from '@/types/server-entities/snapshot';
import { ActionIcon, Box, Group, Text, useMantineColorScheme } from '@mantine/core';
import { ICellRendererParams } from 'ag-grid-community';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
// Custom cell renderer with diff support for suggested values

export const useCellRenderer = (
  table: TableSpec,
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>,
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>,
) => {
  type TValue = unknown;
  type TContext = unknown;
  const { colorScheme } = useMantineColorScheme();
  const isLightMode = colorScheme === 'light';
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
      const SuggestionButtons = () => {
        const [isProcessing, setIsProcessing] = useState(false);
        // const { colorScheme } = useMantineColorScheme();
        // const isLightMode = colorScheme === 'light';

        const handleAccept = async (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (!acceptCellValues || isProcessing) return;
          try {
            setIsProcessing(true);
            await acceptCellValues([{ wsId: record.id.wsId, columnId: columnDef.id.wsId }]);
            ScratchpadNotifications.success({
              title: 'Suggestion Accepted',
              message: `Accepted suggestion for ${columnDef.name}`,
            });
          } catch (error) {
            console.error('Error accepting suggestion:', error);
            ScratchpadNotifications.error({
              title: 'Error accepting suggestion',
              message: error instanceof Error ? error.message : 'Failed to accept suggestion',
            });
          } finally {
            setIsProcessing(false);
          }
        };

        const handleReject = async (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (!rejectCellValues || isProcessing) return;

          try {
            setIsProcessing(true);
            await rejectCellValues([{ wsId: record.id.wsId, columnId: columnDef.id.wsId }]);
            ScratchpadNotifications.success({
              title: 'Suggestion Rejected',
              message: `Rejected suggestion for ${columnDef.name}`,
            });
          } catch (error) {
            console.error('Error rejecting suggestion:', error);
            ScratchpadNotifications.error({
              title: 'Error rejecting suggestion',
              message: error instanceof Error ? error.message : 'Failed to reject suggestion',
            });
          } finally {
            setIsProcessing(false);
          }
        };

        return (
          <Group
            gap={3}
            style={{
              position: 'absolute',
              right: '0px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
              backgroundColor: isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(5px)',
              padding: '5px',
            }}
            className="suggestion-buttons"
          >
            <ActionIcon
              size="xs"
              // variant="light"
              color="suggestion"
              // onClick={handleAccept}
              onMouseDown={handleAccept}
              disabled={isProcessing}
            >
              <Check size={10} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="light"
              color="red"
              // onClick={handleReject}
              onMouseDown={handleReject}
              disabled={isProcessing}
            >
              <X size={10} />
            </ActionIcon>
          </Group>
        );
      };

      // If there's no existing value, just show the suggested value
      if (!formattedValue || formattedValue === '' || formattedValue === 'null' || formattedValue === 'undefined') {
        return (
          <Box
            display="flex"
            h="100%"
            style={{
              alignItems: 'center',
              overflow: 'hidden',
              textOverflow: 'clip',
              whiteSpace: 'nowrap',
              position: 'relative',
            }}
            className="cell-with-suggestion"
          >
            <Text className="cell-text">{String(suggestedValue)}</Text>
            <SuggestionButtons />
          </Box>
        );
      }

      // Use diff to show changes when there's both existing and suggested values
      return (
        <Box
          display="flex"
          h="100%"
          style={{
            alignItems: 'center',
            overflow: 'hidden',
            textOverflow: 'clip',
            whiteSpace: 'nowrap',
            position: 'relative',
          }}
          className="cell-with-suggestion"
        >
          <DiffText2 originalValue={formattedValue} suggestedValue={String(suggestedValue)} />
          <SuggestionButtons />
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
