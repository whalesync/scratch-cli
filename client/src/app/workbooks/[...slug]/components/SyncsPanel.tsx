import { Text13Medium } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { syncApi } from '@/lib/api/sync';
import { useSyncStore } from '@/stores/sync-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { ActionIcon, Box, Group, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Sync, SyncId } from '@spinner/shared-types';
import { Eye, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AddSyncDialog } from './dialogs/AddSyncDialog';
import { SyncCard } from './SyncCard';

export function SyncsPanel() {
  const { workbook } = useActiveWorkbook();
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const syncs = useSyncStore((state) => state.syncs);
  const activeJobs = useSyncStore((state) => state.activeJobs);
  const fetchSyncs = useSyncStore((state) => state.fetchSyncs);
  const runSync = useSyncStore((state) => state.runSync);

  const [isAddSyncOpen, setIsAddSyncOpen] = useState(false);
  const [editingSync, setEditingSync] = useState<Sync | null>(null);

  useEffect(() => {
    if (workbook?.id) {
      // We can wrap this to show loading overlay if we want, but store handles it silently usually.
      // Let's rely on store updates.
      fetchSyncs(workbook.id);
    }
  }, [workbook?.id, fetchSyncs]);

  const handleRunSync = async (syncId: SyncId) => {
    if (!workbook?.id) return;
    try {
      await runSync(workbook.id, syncId);
      notifications.show({
        title: 'Sync started',
        message: 'Sync job queued via store',
        color: 'green',
      });
      // Store handles polling and notifications for completion/failure?
      // Actually store doesn't notify on completion yet (notifications are inside the component loop previously).
      // If we want notifications on completion, we should probably add them to the store or subscribe to changes.
      // For now, let's leave the completion notification implicit (spinner stops).
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
      fetchSyncs(workbook.id);
    } catch (error) {
      console.error('Failed to delete sync:', error);
    }
  };

  const hasSyncs = syncs.length > 0;

  return (
    <Stack h="100%" gap={0} bg="var(--bg-base)">
      {/* List loading could be tracked if we added isLoadingSyncs to store. For now, we assume fast load or silent update. */}

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
              <SyncCard
                key={sync.id}
                sync={sync}
                onDelete={() => handleDelete(sync)}
                onRun={() => handleRunSync(sync.id)}
                onEdit={() => {
                  setEditingSync(sync);
                  setIsAddSyncOpen(true);
                }}
                loading={!!activeJobs[sync.id]}
              />
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
        onClose={() => {
          setIsAddSyncOpen(false);
          setEditingSync(null);
        }}
        syncToEdit={editingSync || undefined}
        onSyncCreated={() => {
          setIsAddSyncOpen(false);
          setEditingSync(null);
          if (workbook?.id) fetchSyncs(workbook.id);
        }}
      />
    </Stack>
  );
}
