import { ActionIcon, Card, Group, Menu, Stack, Text, Tooltip } from '@mantine/core';
import { Sync } from '@spinner/shared-types';
import { Clock, MoreHorizontal, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface SyncCardProps {
  sync: Sync;
  onDelete: () => void;
  onRun?: () => Promise<void> | void;
}

export function SyncCard({ sync, onDelete, onRun }: SyncCardProps) {
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      if (onRun) {
        await onRun();
      }
      // Demo animation for 3 seconds if onRun finishes quickly, or just relies on state
      // If onRun is provided, assume it handles logic.
      // But user wanted "animated... for 3 seconds".
      // I'll add a minimum delay
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card withBorder padding="xs" radius="md">
      <Group justify="space-between" wrap="nowrap" gap="xs">
        {/* Left: Run Button */}
        <Tooltip label={isRunning ? 'Syncing...' : 'Run Sync'}>
          <ActionIcon
            variant={isRunning ? 'light' : 'subtle'}
            color={isRunning ? 'blue' : 'gray'}
            size="sm"
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <RefreshCw size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play size={14} />
            )}
          </ActionIcon>
        </Tooltip>

        {/* Middle: Info */}
        <Stack gap={0} style={{ flex: 1, overflow: 'hidden' }}>
          <Text size="xs" fw={500} truncate>
            {sync.displayName}
          </Text>
          <Group gap={4} wrap="nowrap">
            <Clock size={10} className="text-gray-500" />
            <Text fz={10} c="dimmed" truncate>
              {sync.lastSyncTime ? new Date(sync.lastSyncTime).toLocaleDateString() : 'Never'}
            </Text>
          </Group>
        </Stack>

        {/* Right: Menu */}
        <Menu position="bottom-end" shadow="md" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm">
              <MoreHorizontal size={14} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<Trash2 size={14} />} color="red" onClick={onDelete}>
              Delete Sync
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Card>
  );
}
