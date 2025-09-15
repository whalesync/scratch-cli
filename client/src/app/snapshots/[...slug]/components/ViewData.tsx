'use client';

import { AcceptSuggestionButton, RejectSuggestionButton, SecondaryButton } from '@/app/components/base/buttons';
import { TextBookSm, TextRegularXs, TextTitleXs } from '@/app/components/base/text';
import { DotSpacer } from '@/app/components/DotSpacer';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
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

interface ViewDataProps {
  currentTableId?: string | null;
  count?: number;
  filteredCount?: number;
}
/**
 *  @deprecated Use RecordDataToolbar instead. Keeping this around for all the view management functionality which we will probably reuse elswhere.
 *  @see RecordDataToolbar
 */
export const ViewData = ({ currentTableId, count, filteredCount }: ViewDataProps) => {
  const {
    views,
    isLoading,
    error,
    refreshViews,
    snapshot,
    clearActiveRecordFilter,
    currentViewId,
    setCurrentViewId,
    viewDataAsAgent,
    setViewDataAsAgent,
  } = useSnapshotContext();
  const { recordsWithSuggestions, totalSuggestions, acceptAllSuggestions, rejectAllSuggestions, refreshRecords } =
    useSnapshotTableRecords({
      snapshotId: snapshot?.id ?? '',
      tableId: currentTableId ?? '',
      viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
    });
  const { readFocus, writeFocus, clearReadFocus, clearWriteFocus } = useAgentChatContext();
  const snapshotId = snapshot?.id;
  const [debugView, setDebugView] = useState<
    ColumnView | { readFocus: typeof readFocus; writeFocus: typeof writeFocus } | null
  >(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sqlFilterModalOpen, setSqlFilterModalOpen] = useState(false);
  const [sqlFilterText, setSqlFilterText] = useState('');
  const [sqlFilterError, setSqlFilterError] = useState<string | null>(null);

  const currentView = views?.find((v) => v.id === currentViewId);

  const currentTableFilter =
    currentTableId && snapshot && snapshot.activeRecordSqlFilter && currentTableId in snapshot.activeRecordSqlFilter
      ? snapshot.activeRecordSqlFilter[currentTableId]
      : undefined;

  useEffect(() => {
    if (sqlFilterModalOpen) {
      setSqlFilterText(currentTableFilter || '');
      setSqlFilterError(null); // Clear any previous errors
    }
  }, [sqlFilterModalOpen, currentTableFilter]);

  const handleRenameView = async () => {
    if (!currentView) return;

    setSaving(true);
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
      setSaving(false);
    }
  };

  const handleRenameWithName = async () => {
    if (!currentView || !viewName.trim() || !snapshotId) return;

    setSaving(true);
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
      setSaving(false);
    }
  };

  const handleDeleteView = async () => {
    if (!currentView) return;

    setSaving(true);
    try {
      await viewApi.delete(currentView.id);
      notifications.show({
        title: 'View Deleted',
        message: `View "${formatViewName(currentView)}" has been deleted`,
        color: 'green',
      });
      setDeleteModalOpen(false);
      setCurrentViewId?.(null);
      setViewDataAsAgent(false);
      await refreshViews?.();
    } catch (error) {
      console.error('Error deleting view:', error);
      notifications.show({
        title: 'Error Deleting View',
        message: error instanceof Error ? error.message : 'Failed to delete view',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSetSqlFilter = async () => {
    if (!currentTableId || !snapshot) return;

    setSqlFilterError(null); // Clear any previous errors

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
      const errorMessage = error instanceof Error ? error.message : 'Failed to set SQL filter';
      setSqlFilterError(errorMessage);
    }
  };

  const handleAcceptAllSuggestions = async () => {
    try {
      setSaving(true);
      const { recordsUpdated, totalChangesAccepted } = await acceptAllSuggestions();
      ScratchpadNotifications.success({
        title: 'Suggestions Accepted',
        message: `Accepted ${totalChangesAccepted} ${pluralize('change', totalChangesAccepted)} for ${recordsUpdated} ${pluralize('record', recordsUpdated)} in the table`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error accepting all suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Suggestions',
        message: error instanceof Error ? error.message : 'Failed to accept all suggestions',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRejectAllSuggestions = async () => {
    try {
      setSaving(true);
      const { recordsRejected, totalChangesRejected } = await rejectAllSuggestions();
      ScratchpadNotifications.success({
        title: 'Suggestions Rejected',
        message: `Rejected ${totalChangesRejected} ${pluralize('change', totalChangesRejected)} for ${recordsRejected} ${pluralize('record', recordsRejected)} in the table`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error accepting all suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Suggestions',
        message: error instanceof Error ? error.message : 'Failed to reject all suggestions',
      });
    } finally {
      setSaving(false);
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
    <Box h="100%">
      <Group gap="md" align="center" wrap="nowrap">
        {/* Column Views Section */}
        <Group gap="xs" align="center">
          <TextTitleXs>Column Views</TextTitleXs>
          <Select
            value={currentViewId || ''}
            onChange={(value) => setCurrentViewId?.(value || null)}
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
                <Checkbox
                  checked={viewDataAsAgent}
                  onChange={(e) => setViewDataAsAgent?.(e.target.checked)}
                  size="xs"
                  title="View as AI Agent"
                />
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
          {count !== undefined && filteredCount !== undefined && count > filteredCount ? (
            <>
              <DotSpacer mx={0} />
              <TextBookSm>
                {`${count - filteredCount} ${pluralize('record', count - filteredCount)} filtered`}
              </TextBookSm>
            </>
          ) : null}
        </Group>
        {recordsWithSuggestions > 0 && (
          <Group gap="xs" ml="auto">
            <Tooltip
              label={`${recordsWithSuggestions} ${pluralize('record', recordsWithSuggestions)} with pending suggestions found`}
            >
              <TextRegularXs>
                {totalSuggestions} {pluralize('suggestion', totalSuggestions)}
              </TextRegularXs>
            </Tooltip>
            <AcceptSuggestionButton size="xs" onClick={handleAcceptAllSuggestions}>
              Accept all
            </AcceptSuggestionButton>
            <RejectSuggestionButton size="xs" onClick={handleRejectAllSuggestions}>
              Reject all
            </RejectSuggestionButton>
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
            <Button onClick={handleRenameWithName} loading={saving} disabled={!viewName.trim()}>
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
            <Button color="red" onClick={handleDeleteView} loading={saving}>
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
            onChange={(e) => {
              setSqlFilterText(e.target.value);
              if (sqlFilterError) {
                setSqlFilterError(null); // Clear error when user starts typing
              }
            }}
            placeholder="Enter SQL WHERE clause..."
            minRows={3}
            error={sqlFilterError}
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
