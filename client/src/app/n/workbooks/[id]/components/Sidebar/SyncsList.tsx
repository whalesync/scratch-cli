'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text12Medium, Text12Regular } from '@/app/components/base/text';
import { useSyncStore } from '@/stores/sync-store';
import { Box, Group, ScrollArea, Stack, Tooltip, UnstyledButton } from '@mantine/core';
import type { Sync, WorkbookId } from '@spinner/shared-types';
import { ClockIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface SyncsListProps {
  workbookId: WorkbookId;
}

export function SyncsList({ workbookId }: SyncsListProps) {
  const syncs = useSyncStore((state) => state.syncs);
  const activeJobs = useSyncStore((state) => state.activeJobs);
  const fetchSyncs = useSyncStore((state) => state.fetchSyncs);
  const isLoading = useSyncStore((state) => state.isLoading);

  const params = useParams<{ syncId?: string }>();
  const router = useRouter();

  useEffect(() => {
    fetchSyncs(workbookId);
  }, [workbookId, fetchSyncs]);

  const handleCreateNew = () => {
    router.push(`/n/workbooks/${workbookId}/syncs/new`);
  };

  if (isLoading && syncs.length === 0) {
    return (
      <Box p="md">
        <Text12Regular c="dimmed">Loading syncs...</Text12Regular>
      </Box>
    );
  }

  return (
    <ScrollArea h="100%" type="auto" offsetScrollbars>
      <Stack gap={0} py="xs">
        {/* Create New Sync button */}
        <UnstyledButton
          onClick={handleCreateNew}
          px="sm"
          py={6}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
          }}
        >
          <Group gap={6} wrap="nowrap">
            <StyledLucideIcon Icon={PlusIcon} size="sm" c="var(--mantine-color-blue-6)" />
            <Text12Regular c="var(--mantine-color-blue-6)">New Sync</Text12Regular>
          </Group>
        </UnstyledButton>

        {/* Divider */}
        {syncs.length > 0 && (
          <Box my="xs" mx="sm" style={{ borderBottom: '1px solid var(--fg-divider)' }} />
        )}

        {/* Sync list */}
        {syncs.map((sync) => (
          <SyncItem
            key={sync.id}
            sync={sync}
            workbookId={workbookId}
            isActive={params.syncId === sync.id}
            isRunning={!!activeJobs[sync.id]}
          />
        ))}

        {/* Empty state */}
        {syncs.length === 0 && (
          <Box p="md">
            <Text12Regular c="dimmed">No syncs configured yet</Text12Regular>
          </Box>
        )}
      </Stack>
    </ScrollArea>
  );
}

interface SyncItemProps {
  sync: Sync;
  workbookId: WorkbookId;
  isActive: boolean;
  isRunning: boolean;
}

function SyncItem({ sync, workbookId, isActive, isRunning }: SyncItemProps) {
  const href = `/n/workbooks/${workbookId}/syncs/${sync.id}`;

  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <UnstyledButton
        px="sm"
        py={6}
        style={{
          width: '100%',
          backgroundColor: isActive ? 'var(--bg-selected)' : 'transparent',
          borderLeft: isActive ? '3px solid var(--mantine-color-blue-6)' : '3px solid transparent',
        }}
      >
        <Group gap={8} wrap="nowrap" justify="space-between">
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            {isRunning ? (
              <RefreshCwIcon
                size={14}
                style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
                color="var(--mantine-color-blue-6)"
              />
            ) : (
              <StyledLucideIcon Icon={RefreshCwIcon} size="sm" c="var(--fg-secondary)" />
            )}
            <Text12Medium c="var(--fg-primary)" truncate style={{ flex: 1 }}>
              {sync.displayName}
            </Text12Medium>
          </Group>

          {sync.lastSyncTime && (
            <Tooltip label={`Last run: ${new Date(sync.lastSyncTime).toLocaleString()}`} position="right">
              <Group gap={4} wrap="nowrap">
                <ClockIcon size={10} color="var(--fg-muted)" />
                <Text12Regular c="dimmed" style={{ fontSize: 10 }}>
                  {formatRelativeTime(sync.lastSyncTime)}
                </Text12Regular>
              </Group>
            </Tooltip>
          )}
        </Group>
      </UnstyledButton>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Link>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}
