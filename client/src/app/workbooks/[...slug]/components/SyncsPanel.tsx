import { Text13Medium } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { syncApi } from '@/lib/api/sync';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { ActionIcon, Box, Group, LoadingOverlay, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { Sync } from '@spinner/shared-types';
import { Eye, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AddSyncDialog } from './dialogs/AddSyncDialog';
import { SyncCard } from './SyncCard';

export function SyncsPanel() {
  const { workbook } = useActiveWorkbook();
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
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

  const handleDelete = async (sync: Sync) => {
    if (!workbook?.id) return;
    if (!window.confirm(`Are you sure you want to delete "${sync.displayName}"?`)) return;

    try {
      await syncApi.delete(workbook.id, sync.id);
      fetchSyncs();
    } catch (error) {
      console.error('Failed to delete sync:', error);
    }
  };

  const hasSyncs = syncs.length > 0;

  return (
    <Stack h="100%" gap={0} bg="var(--bg-base)">
      <LoadingOverlay visible={loading} overlayProps={{ blur: 1 }} />

      {/* Header */}
      <Group h={36} px="xs" justify="space-between" style={{ borderBottom: '0.5px solid var(--fg-divider)' }}>
        <Text13Medium>Syncs</Text13Medium>
        <Group gap={4}>
          <Tooltip label="View All Syncs" openDelay={500}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => openFileTab({ id: 'syncs-view', type: 'syncs-view', title: 'Syncs', path: '' })}
            >
              <Eye size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Create Sync" openDelay={500}>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setIsAddSyncOpen(true)}>
              <Plus size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* List */}
      <ScrollArea style={{ flex: 1 }}>
        {hasSyncs ? (
          <Stack gap="xs" p="xs">
            {syncs.map((sync) => (
              <SyncCard key={sync.id} sync={sync} onDelete={() => handleDelete(sync)} />
            ))}
          </Stack>
        ) : (
          <Box p="lg">
            <Text c="dimmed" size="xs" ta="center">
              No syncs configured.
            </Text>
          </Box>
        )}
      </ScrollArea>

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
