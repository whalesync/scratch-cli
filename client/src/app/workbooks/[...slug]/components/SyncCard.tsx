import { ActionIcon, Card, Group, Menu, Stack, Text, Tooltip } from '@mantine/core';
import { Sync } from '@spinner/shared-types';
import { Clock, MoreHorizontal, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface SyncCardProps {
  sync: Sync;
  onDelete: () => void;
  onRun?: () => Promise<void> | void;
  loading?: boolean;
}

export function SyncCard({ sync, onDelete, onRun, loading }: SyncCardProps) {
  const [internalRunning, setInternalRunning] = useState(false);
  const isRunning = loading !== undefined ? loading : internalRunning;

  const handleRun = async () => {
    if (loading === undefined) setInternalRunning(true);
    try {
      if (onRun) {
        await onRun();
      }
    } finally {
      if (loading === undefined) setInternalRunning(false);
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
