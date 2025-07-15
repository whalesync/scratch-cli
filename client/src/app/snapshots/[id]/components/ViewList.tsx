'use client';

import { useViews } from '@/hooks/use-view';
import { viewApi } from '@/lib/api/view';
import { View } from '@/types/server-entities/view';
import { ActionIcon, Box, Group, Loader, Modal, ScrollArea, Select, Text } from '@mantine/core';
import { BugIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import JsonTreeViewer from '../../../components/JsonTreeViewer';

interface ViewListProps {
  snapshotId: string;
  currentViewId?: string | null;
  onViewChange?: (viewId: string | null) => void;
}

export const ViewList = ({ snapshotId, currentViewId, onViewChange }: ViewListProps) => {
  const { views, isLoading, error } = useViews(snapshotId);
  const [debugView, setDebugView] = useState<View | null>(null);

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
              color="red"
              onClick={async () => {
                if (currentView.id) {
                  await viewApi.delete(currentView.id);
                  // Optionally, you can refresh views here if needed
                  onViewChange?.(null);
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
    </Box>
  );
};
