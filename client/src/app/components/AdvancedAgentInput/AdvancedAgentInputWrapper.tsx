'use client';

import { useSnapshot } from '@/hooks/use-snapshot';
import { Box, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdvancedAgentInput } from './AdvancedAgentInput';

export default function AdvancedAgentInputWrapper() {
  const params = useParams();
  const snapshotId = params?.slug?.[0] as string;
  const defaultTableId = params?.slug?.[1] as string;

  const { snapshot, isLoading, error } = useSnapshot(snapshotId);
  const [selectedTableId, setSelectedTableId] = useState<string>(defaultTableId || '');

  useEffect(() => {
    if (snapshot && !selectedTableId) {
      // Set default table if provided in URL, otherwise use first table
      if (defaultTableId && snapshot.tables.some((table) => table.id.wsId === defaultTableId)) {
        setSelectedTableId(defaultTableId);
      } else if (snapshot.tables.length > 0) {
        setSelectedTableId(snapshot.tables[0].id.wsId);
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

  const tableOptions = snapshot.tables.map((table) => ({
    value: table.id.wsId,
    label: table.name,
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
          <AdvancedAgentInput snapshotId={snapshotId} tableId={selectedTableId} snapshot={snapshot} />
        )}
      </Stack>
    </Box>
  );
}
