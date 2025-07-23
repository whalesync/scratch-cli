'use client';

import { useSnapshotContext } from '@/app/snapshots/[id]/SnapshotContext';
import { viewApi } from '@/lib/api/view';
import { ColumnView } from '@/types/server-entities/view';
import { ActionIcon, Box, Button, Checkbox, Group, Loader, Modal, Select, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BugIcon, FloppyDiskIcon, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import JsonTreeViewer from '../../../components/JsonTreeViewer';
import { useFocusedCellsContext } from '../FocusedCellsContext';

interface ViewDataProps {
  currentViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
  filterToView?: boolean;
  onFilterToViewChange?: (filterToView: boolean) => void;
  currentTableId?: string | null;
}

export const ViewData = ({
  currentViewId,
  onViewChange,
  filterToView = false,
  onFilterToViewChange,
  currentTableId,
}: ViewDataProps) => {
  const { views, isLoading, error, refreshViews, snapshot, clearActiveRecordFilter } = useSnapshotContext();
  const { readFocus, writeFocus, clearReadFocus, clearWriteFocus } = useFocusedCellsContext();
  const snapshotId = snapshot?.id;
  const [debugView, setDebugView] = useState<
    ColumnView | { readFocus: typeof readFocus; writeFocus: typeof writeFocus } | null
  >(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRenameView = async () => {
    if (!currentView) return;

    setRenaming(true);
    try {
      if (!currentView.name) {
        // View has no name - show name prompt
        setViewName(''); // Start with empty name
        setRenameModalOpen(true);
        return;
      } else {
        // View has a name - show rename prompt
        setViewName(currentView.name);
        setRenameModalOpen(true);
        return;
      }
    } catch (error) {
      console.error('Error renaming view:', error);
    } finally {
      setRenaming(false);
    }
  };

  const handleRenameWithName = async () => {
    if (!currentView || !viewName.trim() || !snapshotId) return;

    setRenaming(true);
    try {
      await viewApi.upsert({
        id: currentView.id,
        name: viewName.trim(),
        snapshotId: snapshotId,
        config: currentView.config,
      });

      notifications.show({
        title: 'View Renamed',
        message: `View renamed to "${viewName.trim()}"`,
        color: 'green',
      });

      setRenameModalOpen(false);
      setViewName('');
      await refreshViews?.();
    } catch (error) {
      console.error('Error renaming view:', error);
      notifications.show({
        title: 'Error Renaming View',
        message: error instanceof Error ? error.message : 'Failed to rename view',
        color: 'red',
      });
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteView = async () => {
    if (!currentView) return;

    setDeleting(true);
    try {
      await viewApi.delete(currentView.id);

      notifications.show({
        title: 'View Deleted',
        message: `View "${formatViewName(currentView)}" has been deleted`,
        color: 'green',
      });

      setDeleteModalOpen(false);
      onViewChange?.(null); // Clear the current view selection
      await refreshViews?.();
    } catch (error) {
      console.error('Error deleting view:', error);
      notifications.show({
        title: 'Error Deleting View',
        message: error instanceof Error ? error.message : 'Failed to delete view',
        color: 'red',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Box p="xs" bg="gray.0">
        <Group>
          <Loader size="sm" />
          <Text size="sm">Loading views...</Text>
        </Group>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p="xs" bg="red.0">
        <Text size="sm" c="red">
          Error loading views: {error.message}
        </Text>
      </Box>
    );
  }

  const formatViewName = (view: ColumnView) => {
    if (!view.name) {
      return 'Unnamed View';
    }
    return view.name;
  };

  const currentView = views?.find((v) => v.id === currentViewId);

  const currentTableFilter =
    currentTableId && snapshot && snapshot.activeFiltersByTable && currentTableId in snapshot.activeFiltersByTable
      ? snapshot.activeFiltersByTable[currentTableId]
      : undefined;

  return (
    <Box p="xs" bg="blue.0">
      <Group gap="md" align="center">
        {/* Column Views Section */}
        <Group gap="xs" align="center">
          <Text size="sm" fw={500}>
            Column Views:
          </Text>
          <Select
            value={currentViewId || ''}
            onChange={(value) => onViewChange?.(value || null)}
            data={[
              { value: '', label: 'No view selected' },
              ...(views?.map((view) => ({
                value: view.id,
                label: formatViewName(view),
              })) || []),
            ]}
            size="xs"
            placeholder="Select a view"
            style={{ minWidth: 150 }}
          />
          {currentView && (
            <>
              <ActionIcon size="sm" variant="subtle" onClick={handleRenameView} title="Rename view">
                <FloppyDiskIcon size={14} />
              </ActionIcon>
              <ActionIcon size="sm" variant="subtle" onClick={() => setDebugView(currentView)} title="Debug view data">
                <BugIcon size={14} />
              </ActionIcon>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={() => setDeleteModalOpen(true)}
                title="Delete view"
              >
                <Trash size={14} />
              </ActionIcon>
              <Checkbox
                checked={filterToView}
                onChange={(e) => onFilterToViewChange?.(e.target.checked)}
                size="xs"
                title="See as AI"
              />
            </>
          )}
        </Group>

        {/* Separator */}
        <Text size="sm" c="dimmed">
          |
        </Text>

        {/* Focus Information */}
        <Group gap="xs" align="center">
          <Button
            size="xs"
            variant="light"
            color="blue"
            onClick={clearReadFocus}
            disabled={readFocus.length === 0}
            title={readFocus.length > 0 ? `Clear ${readFocus.length} read focused cell(s)` : 'No read focused cells'}
          >
            Read focus {readFocus.length}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="orange"
            onClick={clearWriteFocus}
            disabled={writeFocus.length === 0}
            title={
              writeFocus.length > 0 ? `Clear ${writeFocus.length} write focused cell(s)` : 'No write focused cells'
            }
          >
            Write focus {writeFocus.length}
          </Button>
          <ActionIcon
            size="sm"
            variant="subtle"
            onClick={() => setDebugView({ readFocus, writeFocus })}
            disabled={readFocus.length === 0 && writeFocus.length === 0}
            title={readFocus.length > 0 || writeFocus.length > 0 ? 'Debug focus' : 'No focused cells to debug'}
          >
            <BugIcon size={14} />
          </ActionIcon>
        </Group>

        {/* Separator */}
        <Text size="sm" c="dimmed">
          |
        </Text>

        {/* Filtered Records Widget */}
        {currentTableFilter && (
          <Group gap="xs" align="center">
            <Text size="sm" fw={500} c="red">
              {currentTableFilter.length} filtered
            </Text>
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => currentTableId && clearActiveRecordFilter(currentTableId)}
            >
              Clear Filter
            </Button>
          </Group>
        )}
      </Group>

      {/* Rename Modal */}
      <Modal opened={renameModalOpen} onClose={() => setRenameModalOpen(false)} title="Rename View" size="sm">
        <Box>
          <TextInput
            label="View Name"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Enter view name"
            mb="md"
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRenameModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameWithName} loading={renaming} disabled={!viewName.trim()}>
              Rename
            </Button>
          </Group>
        </Box>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete View" size="sm">
        <Box>
          <Text mb="md">
            Are you sure you want to delete the view &ldquo;{currentView ? formatViewName(currentView) : ''}&rdquo;?
            This action cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleDeleteView} loading={deleting}>
              Delete
            </Button>
          </Group>
        </Box>
      </Modal>

      {/* Debug Modal */}
      <Modal opened={!!debugView} onClose={() => setDebugView(null)} title="Debug View" size="lg">
        {debugView && <JsonTreeViewer jsonData={debugView} />}
      </Modal>
    </Box>
  );
};
