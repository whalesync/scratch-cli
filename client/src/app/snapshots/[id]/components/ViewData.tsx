'use client';

import { SecondaryButton } from '@/app/components/base/buttons';
import { TextBookSm, TextTitleXs } from '@/app/components/base/text';
import { DotSpacer } from '@/app/components/DotSpacer';
import { useSnapshotContext } from '@/app/snapshots/[id]/SnapshotContext';
import { snapshotApi } from '@/lib/api/snapshot';
import { viewApi } from '@/lib/api/view';
import { ColumnView } from '@/types/server-entities/view';
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Select,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BugIcon, PencilSimpleLineIcon, TrashIcon } from '@phosphor-icons/react';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import JsonTreeViewer from '../../../components/JsonTreeViewer';
import { useFocusedCellsContext } from '../FocusedCellsContext';

interface ViewDataProps {
  currentViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
  filterToView?: boolean;
  onFilterToViewChange?: (filterToView: boolean) => void;
  currentTableId?: string | null;
  count?: number;
  filteredCount?: number;
}

export const ViewData = ({
  currentViewId,
  onViewChange,
  filterToView = false,
  onFilterToViewChange,
  currentTableId,
  count,
  filteredCount,
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
  const [sqlFilterModalOpen, setSqlFilterModalOpen] = useState(false);
  const [sqlFilterText, setSqlFilterText] = useState('');

  const currentView = views?.find((v) => v.id === currentViewId);

  const currentTableFilter =
    currentTableId && snapshot && snapshot.activeRecordSqlFilter && currentTableId in snapshot.activeRecordSqlFilter
      ? snapshot.activeRecordSqlFilter[currentTableId]
      : undefined;

  useEffect(() => {
    if (sqlFilterModalOpen) {
      setSqlFilterText(currentTableFilter || '');
    }
  }, [sqlFilterModalOpen, currentTableFilter]);

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

  const handleSetSqlFilter = async () => {
    if (!currentTableId || !snapshot) return;

    try {
      await snapshotApi.setActiveRecordsFilter(snapshot.id, currentTableId, sqlFilterText || undefined);
      notifications.show({
        title: 'Filter Updated',
        message: 'SQL filter has been applied',
        color: 'green',
      });
      setSqlFilterModalOpen(false);
      setSqlFilterText('');
    } catch (error) {
      console.error('Error setting SQL filter:', error);
      notifications.show({
        title: 'Error Setting Filter',
        message: error instanceof Error ? error.message : 'Failed to set SQL filter',
        color: 'red',
      });
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

  return (
    <Box h="50px" p="6px" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
      <Group gap="md" align="center">
        {/* Column Views Section */}
        <Group gap="xs" align="center">
          <TextTitleXs>Column Views</TextTitleXs>
          <Select
            value={currentViewId || ''}
            onChange={(value) => onViewChange?.(value || null)}
            data={[
              { value: '', label: 'No active view' },
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
                <PencilSimpleLineIcon size={14} />
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
                <TrashIcon size={14} />
              </ActionIcon>
              <Tooltip label="View as AI Agent">
                <Checkbox checked={filterToView} onChange={(e) => onFilterToViewChange?.(e.target.checked)} size="xs" />
              </Tooltip>
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
        <Group gap="xs" align="center">
          <SecondaryButton size="xs" onClick={() => setSqlFilterModalOpen(true)}>
            Set SQL Filter
          </SecondaryButton>
          {currentTableFilter && (
            <SecondaryButton size="xs" onClick={() => currentTableId && clearActiveRecordFilter(currentTableId)}>
              Clear Filter
            </SecondaryButton>
          )}
          {count !== undefined && filteredCount !== undefined ? (
            <>
              <DotSpacer mx={0} />
              <TextBookSm>
                {count !== undefined && filteredCount !== undefined
                  ? `${count - filteredCount} ${pluralize('record', count - filteredCount)} filtered`
                  : 'Filtered'}
              </TextBookSm>
            </>
          ) : null}
        </Group>
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

      {/* SQL Filter Modal */}
      <Modal opened={sqlFilterModalOpen} onClose={() => setSqlFilterModalOpen(false)} title="Set SQL Filter" size="md">
        <Box>
          <Text size="sm" mb="xs">
            Enter a SQL WHERE clause to filter records. Leave empty to clear the filter.
          </Text>
          <Text size="xs" c="dimmed" mb="md">
            Example: name = &apos;John&apos; AND age &gt; 25
          </Text>
          <Textarea
            label="SQL WHERE Clause"
            value={sqlFilterText}
            onChange={(e) => setSqlFilterText(e.target.value)}
            placeholder="Enter SQL WHERE clause..."
            minRows={3}
            mb="md"
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setSqlFilterModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetSqlFilter} loading={false}>
              Apply Filter
            </Button>
          </Group>
        </Box>
      </Modal>
    </Box>
  );
};
