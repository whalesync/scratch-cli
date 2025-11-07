'use client';

import { Box, Group, Loader, Paper, Select, Stack, Text } from '@mantine/core';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActiveSnapshot } from '../../../hooks/use-active-snapshot';
import { AdvancedAgentInput } from './AdvancedAgentInput';

export default function AdvancedAgentInputWrapper() {
  const params = useParams();
  const snapshotId = params?.slug?.[0] as string;
  const defaultTableId = params?.slug?.[1] as string;

  const { snapshot, isLoading, error } = useActiveSnapshot();
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
    if (snapshot && !selectedTableId) {
      // Set default table if provided in URL, otherwise use first table
      if (defaultTableId && snapshot.snapshotTables?.some((table) => table.tableSpec.id.wsId === defaultTableId)) {
        setSelectedTableId(defaultTableId);
      } else if (snapshot.snapshotTables && snapshot.snapshotTables.length > 0) {
        setSelectedTableId(snapshot.snapshotTables[0].tableSpec.id.wsId);
      }
    }
  }, [snapshot, defaultTableId, selectedTableId]);

  if (isLoading) {
    return (
      <Box p="xl" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Group justify="center" p="xl">
          <Loader size="md" />
          <Text>Loading snapshot...</Text>
        </Group>
      </Box>
    );
  }

  if (error || !snapshot) {
    return (
      <Box p="xl" style={{ maxWidth: 800, margin: '0 auto' }}>
        <Text c="red" fw={600}>
          Error: {error?.message || 'Snapshot not found'}
        </Text>
      </Box>
    );
  }

  const tableOptions = snapshot.snapshotTables?.map((table) => ({
    value: table.tableSpec.id.wsId,
    label: table.tableSpec.name,
  }));

  return (
    <Box p="xl" style={{ maxWidth: 800, margin: '0 auto' }}>
      <Stack gap="xl">
        {/* Header with snapshot info and table picker */}
        <Box>
          <Group justify="space-between" align="center" mb="md">
            <Box>
              <Text size="lg" fw={600}>
                {snapshot.name}
              </Text>
              <Text size="sm" c="dimmed">
                Snapshot ID: {snapshot.id}
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
            snapshotId={snapshotId}
            tableId={selectedTableId}
            snapshot={snapshot}
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
