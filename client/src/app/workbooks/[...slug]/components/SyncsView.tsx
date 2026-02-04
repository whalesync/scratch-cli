import { Text13Medium } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { syncApi } from '@/lib/api/sync';
import { Box, Button, Group, LoadingOverlay, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Sync, SyncId } from '@spinner/shared-types';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AddSyncDialog } from './dialogs/AddSyncDialog';
import { SyncCard } from './SyncCard';

export function SyncsView() {
  const { workbook } = useActiveWorkbook();
  const [isAddSyncOpen, setIsAddSyncOpen] = useState(false);
  const [syncs, setSyncs] = useState<Sync[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSyncs = useCallback(async () => {
    if (!workbook?.id) return;
    setLoading(true);
    try {
      const data = await syncApi.list(workbook.id);
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

  const handleRunSync = async (syncId: SyncId) => {
    if (!workbook?.id) return;
    try {
      const result = await syncApi.run(workbook.id, syncId);
      console.log('Sync job ID:', result.jobId);
      notifications.show({
        title: 'Sync started',
        message: result.message,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Failed to start sync',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDelete = async (sync: Sync) => {
    if (!workbook?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${sync.displayName}"?`)) return;

    try {
      await syncApi.delete(workbook.id, sync.id);
      console.log('Deleted sync', sync.id);
      fetchSyncs();
    } catch (error) {
      console.error('Failed to delete sync:', error);
    }
  };

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
            <SyncCard
              key={sync.id}
              sync={sync}
              onDelete={() => handleDelete(sync)}
              onRun={() => handleRunSync(sync.id)}
            />
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
