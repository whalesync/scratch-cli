'use client';

import { useViews } from '@/hooks/use-view';
import { viewApi } from '@/lib/api/view';
import { View } from '@/types/server-entities/view';
import { ActionIcon, Box, Button, Group, Loader, Modal, ScrollArea, Select, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { BugIcon, FloppyDiskIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import JsonTreeViewer from '../../../components/JsonTreeViewer';

interface ViewListProps {
  snapshotId: string;
  currentViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
}

export const ViewList = ({ snapshotId, currentViewId, onViewChange }: ViewListProps) => {
  const { views, isLoading, error, refreshViews } = useViews(snapshotId);
  const [debugView, setDebugView] = useState<View | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveView = async () => {
    if (!currentView) return;

    setSaving(true);
    try {
      if (!currentView.name && !currentView.parentId) {
        // New view (no name, no parent) - show name prompt
        setSaveModalOpen(true);
        return;
      } else if (!currentView.name && currentView.parentId) {
        // Forked view (no name, has parent) - save with name and delete parent
        setViewName('Saved View'); // Pre-fill with default name
        setSaveModalOpen(true);
        return;
      }
    } catch (error) {
      console.error('Error saving view:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWithName = async () => {
    if (!currentView || !viewName.trim()) return;

    setSaving(true);
    try {
      const parentIdToDelete = currentView.parentId; // Store parent ID before saving

      await viewApi.upsert({
        id: currentView.id,
        parentId: currentView.parentId || undefined,
        name: viewName.trim(),
        snapshotId: snapshotId,
        config: currentView.config,
      });

      // If this was a forked view (had a parent), delete the parent
      if (parentIdToDelete) {
        await viewApi.delete(parentIdToDelete);
        notifications.show({
          title: 'View Saved',
          message: `View "${viewName.trim()}" saved and parent view deleted`,
          color: 'green',
        });
      } else {
        notifications.show({
          title: 'View Saved',
          message: `View "${viewName.trim()}" saved successfully`,
          color: 'green',
        });
      }

      setSaveModalOpen(false);
      setViewName('');
      await refreshViews();
    } catch (error) {
      console.error('Error saving view:', error);
      notifications.show({
        title: 'Error Saving View',
        message: error instanceof Error ? error.message : 'Failed to save view',
        color: 'red',
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

  const formatViewName = (view: View) => {
    if (!view.name) {
      return view.parentId ? `${view.parentId} (unsaved)` : 'Unsaved View';
    }
    return view.name;
  };

  const selectData =
    views?.map((view) => ({
      value: view.id,
      label: formatViewName(view),
    })) || [];

  // Add "No View" option
  selectData.unshift({ value: 'none', label: 'No View (All Records)' });

  const handleViewChange = (value: string | null) => {
    const viewId = value === 'none' ? null : value;
    onViewChange?.(viewId);
  };

  const currentView = views?.find((v) => v.id === currentViewId);

  return (
    <Box p="xs" bg="blue.0">
      <Group gap="xs" align="center">
        <Text size="sm" fw={500}>
          Current View:
        </Text>
        <Select
          size="xs"
          data={selectData}
          value={currentViewId || 'none'}
          onChange={handleViewChange}
          placeholder="Select a view"
          style={{ minWidth: 200 }}
        />
        {currentView && (
          <>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => setDebugView(currentView)}
              title="Debug current view"
            >
              <BugIcon size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="blue"
              onClick={handleSaveView}
              loading={saving}
              disabled={!!currentView.name && !currentView.parentId}
              title={
                !!currentView.name && !currentView.parentId
                  ? 'View is already saved'
                  : !currentView.name && !currentView.parentId
                    ? 'Save new view'
                    : 'Save forked view (will delete parent)'
              }
            >
              <FloppyDiskIcon size={12} />
            </ActionIcon>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="red"
              onClick={async () => {
                if (currentView.id) {
                  try {
                    await viewApi.delete(currentView.id);
                    await refreshViews();
                    onViewChange?.(null);
                    notifications.show({
                      title: 'View Deleted',
                      message: 'View deleted successfully',
                      color: 'green',
                    });
                  } catch (error) {
                    notifications.show({
                      title: 'Error Deleting View',
                      message: error instanceof Error ? error.message : 'Failed to delete view',
                      color: 'red',
                    });
                  }
                }
              }}
              title="Delete current view"
            >
              <TrashIcon size={12} />
            </ActionIcon>
          </>
        )}
      </Group>

      <Modal
        opened={!!debugView}
        onClose={() => setDebugView(null)}
        title={`View Debug: ${debugView?.name || 'Unnamed View'}`}
        size="lg"
      >
        <ScrollArea h={500}>
          <JsonTreeViewer jsonData={debugView || {}} />
        </ScrollArea>
      </Modal>

      <Modal opened={saveModalOpen} onClose={() => setSaveModalOpen(false)} title="Save View" size="sm">
        <Box p="md">
          <Text size="sm" mb="md">
            Please enter a name for this view:
          </Text>
          <TextInput
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="Enter view name..."
            mb="md"
            autoFocus
          />
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWithName} loading={saving} disabled={!viewName.trim()}>
              Save
            </Button>
          </Group>
        </Box>
      </Modal>
    </Box>
  );
};
