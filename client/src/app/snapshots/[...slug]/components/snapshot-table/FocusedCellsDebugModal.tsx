import { useAgentChatContext } from '@/contexts/agent-chat-context';
import { Box, Button, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { ColumnSpec } from '../../../../../types/server-entities/snapshot';
import { useSnapshotTableGridContext } from './SnapshotTableGridProvider';

export const FocusedCellsDebugModal = () => {
  const { modalStack, table, sortedRecords } = useSnapshotTableGridContext();
  const { readFocus, writeFocus } = useAgentChatContext();

  return (
    <Modal
      {...modalStack.register('focusedCellsDebug')}
      title={`Focused Cells Debug (${readFocus.length + writeFocus.length})`}
      size="lg"
    >
      <ScrollArea h={500}>
        <Stack gap="md">
          <Text size="sm" fw={500}>
            Read Focus Details ({readFocus.length}):
          </Text>
          {readFocus.length === 0 ? (
            <Text size="sm" c="dimmed">
              No read focused cells
            </Text>
          ) : (
            <Stack gap="xs">
              {readFocus.map((cell, index) => (
                <Box
                  key={`read-${cell.recordWsId}-${cell.columnWsId}`}
                  p="xs"
                  bg="blue.0"
                  style={{ borderRadius: 4, borderLeft: '4px solid #0066cc' }}
                >
                  <Text size="sm">
                    <strong>Read Cell {index + 1}:</strong> Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Column Name:{' '}
                    {table.columns.find((c: ColumnSpec) => c.id.wsId === cell.columnWsId)?.name || 'Unknown'}
                  </Text>
                </Box>
              ))}
            </Stack>
          )}

          <Text size="sm" fw={500}>
            Write Focus Details ({writeFocus.length}):
          </Text>
          {writeFocus.length === 0 ? (
            <Text size="sm" c="dimmed">
              No write focused cells
            </Text>
          ) : (
            <Stack gap="xs">
              {writeFocus.map((cell, index) => (
                <Box
                  key={`write-${cell.recordWsId}-${cell.columnWsId}`}
                  p="xs"
                  bg="orange.0"
                  style={{ borderRadius: 4, borderLeft: '4px solid #ff8c00' }}
                >
                  <Text size="sm">
                    <strong>Write Cell {index + 1}:</strong> Record ID: {cell.recordWsId}, Column ID: {cell.columnWsId}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Column Name:{' '}
                    {table.columns.find((c: ColumnSpec) => c.id.wsId === cell.columnWsId)?.name || 'Unknown'}
                  </Text>
                </Box>
              ))}
            </Stack>
          )}

          <Button
            size="xs"
            variant="outline"
            onClick={() => {
              console.debug('Read Focus:', readFocus);
              console.debug('Write Focus:', writeFocus);
              console.debug('Sorted Records:', sortedRecords);
            }}
          >
            Log to Console
          </Button>
        </Stack>
      </ScrollArea>
    </Modal>
  );
};
