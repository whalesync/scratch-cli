import { Text13Medium } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { syncApi } from '@/lib/api/sync';
import { Box, Button, Card, Group, LoadingOverlay, Stack, Text } from '@mantine/core';
import { Sync } from '@spinner/shared-types';
import { ArrowLeftRight, Clock, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AddSyncDialog } from './dialogs/AddSyncDialog';

export function SyncsView() {
  const { workbook } = useActiveWorkbook();
  const [isAddSyncOpen, setIsAddSyncOpen] = useState(false);
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSyncs = useCallback(async () => {
    console.log('fetchSyncs called', { workbookId: workbook?.id });
    if (!workbook?.id) {
      console.log('No workbook ID, skipping fetch');
      return;
    }
    setLoading(true);
    try {
      console.log('Calling syncApi.list...');
      const data = await syncApi.list(workbook.id);
      console.log('syncApi.list result:', data);
      setSyncs(data);
    } catch (error) {
      console.error('Failed to fetch syncs:', error);
    } finally {
      setLoading(false);
    }
  }, [workbook?.id]);

  useEffect(() => {
    fetchSyncs();
  }, [fetchSyncs]);

  const hasSyncs = syncs.length > 0;

  return (
    <Stack h="100%" gap="md" p="md" pos="relative">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />

      <Group justify="space-between">
        <Text13Medium>Syncs</Text13Medium>
        <Button size="xs" leftSection={<Plus size={14} />} onClick={() => setIsAddSyncOpen(true)}>
          Create Sync
        </Button>
      </Group>

      {hasSyncs ? (
        <Stack gap="sm">
          {syncs.map((sync) => (
            <Card key={sync.id} withBorder padding="sm" radius="md">
              <Group justify="space-between">
                <Group gap="sm">
                  <Box c="blue">
                    <ArrowLeftRight size={20} />
                  </Box>
                  <Stack gap={0}>
                    <Text size="sm" fw={500}>
                      {sync.displayName}
                    </Text>
                    <Group gap={4}>
                      <Clock size={12} className="text-gray-500" />
                      <Text size="xs" c="dimmed">
                        Last run: {sync.lastSyncTime ? new Date(sync.lastSyncTime).toLocaleString() : 'Never'}
                      </Text>
                    </Group>
                  </Stack>
                </Group>
                <Button variant="light" size="xs">
                  Run
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed var(--mantine-color-default-border)',
            borderRadius: 'var(--mantine-radius-md)',
          }}
        >
          <Stack align="center" gap="xs">
            <Text c="dimmed" size="sm">
              No syncs created yet.
            </Text>
            <Button variant="subtle" size="xs" onClick={() => setIsAddSyncOpen(true)}>
              Create your first sync
            </Button>
          </Stack>
        </Box>
      )}

      <AddSyncDialog
        opened={isAddSyncOpen}
        onClose={() => setIsAddSyncOpen(false)}
        onSyncCreated={() => {
          setIsAddSyncOpen(false);
          fetchSyncs();
        }}
      />
    </Stack>
  );
}
