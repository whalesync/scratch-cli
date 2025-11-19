'use client';

import { SnapshotTableId } from '@/types/server-entities/ids';
import { Box, Group, Loader, Paper, Select, Stack, Text } from '@mantine/core';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActiveWorkbook } from '../../../hooks/use-active-workbook';
import { AdvancedAgentInput } from './AdvancedAgentInput';

export default function AdvancedAgentInputWrapper() {
  const params = useParams();
  const defaultTableId = params?.slug?.[1] as string;

  const { workbook, isLoading, error } = useActiveWorkbook();
  // TODO: State move this into the SnapshotEditorUIStore.
  const [selectedTableId, setSelectedTableId] = useState<string>(defaultTableId || '');
  const [inputValue, setInputValue] = useState<string>('');

  // Function to render mentions as plain text
  const renderMentionsAsText = (text: string): string => {
    if (!text) return '';

    // Keep the full markup format for all mentions
    // @[display](id) stays as @[display](id)
    // #[display](id) stays as #[display](id)
    // $[display](id) stays as $[display](id)
    // /[display](id) stays as /[display](id)

    return text;
  };

  useEffect(() => {
    if (workbook && !selectedTableId) {
      // Set default table if provided in URL, otherwise use first table
      if (defaultTableId && workbook.snapshotTables?.some((table) => table.id === defaultTableId)) {
        setSelectedTableId(defaultTableId);
      } else if (workbook.snapshotTables && workbook.snapshotTables.length > 0) {
        setSelectedTableId(workbook.snapshotTables[0].id);
      }
    }
  }, [workbook, defaultTableId, selectedTableId]);

  if (isLoading) {
    return (
      <Box p="xl" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Group justify="center" p="xl">
          <Loader size="md" />
          <Text>Loading workbook...</Text>
        </Group>
      </Box>
    );
  }

  if (error || !workbook) {
    return (
      <Box p="xl" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Text c="red" fw={600}>
          Error: {error?.message || 'Workbook not found'}
        </Text>
      </Box>
    );
  }

  const tableOptions = workbook.snapshotTables?.map((table) => ({
    value: table.id,
    label: table.tableSpec.name,
  }));

  return (
    <Box p="xl" style={{ maxWidth: 800, margin: '0 auto' }}>
      <Stack gap="xl">
        {/* Header with workbook info and table picker */}
        <Box>
          <Group justify="space-between" align="center" mb="md">
            <Box>
              <Text size="lg" fw={600}>
                {workbook.name}
              </Text>
              <Text size="sm" c="dimmed">
                Workbook ID: {workbook.id}
              </Text>
            </Box>
            <Select
              label="Select Table"
              placeholder="Choose a table"
              data={tableOptions}
              value={selectedTableId}
              onChange={(value) => setSelectedTableId(value || '')}
              style={{ minWidth: 200 }}
            />
          </Group>
        </Box>

        {/* Advanced Agent Input */}
        {selectedTableId && (
          <AdvancedAgentInput
            tableId={selectedTableId as SnapshotTableId}
            workbook={workbook}
            onMessageChange={setInputValue}
          />
        )}

        {/* Rendered Text Display */}
        {inputValue && (
          <Paper p="md" withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="dimmed">
                Rendered Text:
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {renderMentionsAsText(inputValue)}
              </Text>
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
