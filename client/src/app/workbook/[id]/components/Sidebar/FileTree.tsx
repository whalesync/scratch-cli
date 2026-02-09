'use client';

import { ButtonCompactDanger, ButtonCompactPrimary, ButtonCompactSecondary } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text12Regular } from '@/app/components/base/text';
import { CreateConnectionModal } from '../shared/CreateConnectionModal';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useNewWorkbookUIStore } from '@/stores/new-workbook-ui-store';
import { dataFolderApi } from '@/lib/api/data-folder';
import { workbookApi } from '@/lib/api/workbook';
import { Box, Group, ScrollArea, Stack, UnstyledButton } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { ConnectorAccount, DataFolderId, Workbook } from '@spinner/shared-types';
import { CloudUploadIcon, DownloadIcon, PlusIcon, RefreshCwIcon, RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ConnectionNode, EmptyConnectionNode } from './TreeNode';

export type FileTreeMode = 'files' | 'review';

interface FileTreeProps {
  workbook: Workbook;
  mode?: FileTreeMode;
}

export interface DirtyFile {
  path: string;
  status: 'added' | 'modified' | 'deleted';
}

const SCRATCH_GROUP_NAME = 'Scratch';

export function FileTree({ workbook, mode = 'files' }: FileTreeProps) {
  const { dataFolderGroups, isLoading, refresh: refreshDataFolders } = useDataFolders(workbook.id);
  const { connectorAccounts, refreshConnectorAccounts } = useConnectorAccounts(workbook.id);
  const expandAll = useNewWorkbookUIStore((state) => state.expandAll);
  const expandedNodes = useNewWorkbookUIStore((state) => state.expandedNodes);
  const router = useRouter();

  // New connection modal
  const [connectionModalOpened, { open: openConnectionModal, close: closeConnectionModal }] = useDisclosure(false);

  const handleConnectionModalClose = useCallback(() => {
    closeConnectionModal();
    // Refresh both data folders and connector accounts after modal closes
    refreshDataFolders();
    refreshConnectorAccounts();
  }, [closeConnectionModal, refreshDataFolders, refreshConnectorAccounts]);

  // For review mode, fetch dirty files
  const [dirtyFiles, setDirtyFiles] = useState<DirtyFile[]>([]);
  const [dirtyFilesLoading, setDirtyFilesLoading] = useState(false);

  // Publish/Discard/Pull state
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const handlePullAll = useCallback(async () => {
    setIsPulling(true);
    try {
      await workbookApi.pullFiles(workbook.id);
      router.refresh();
    } catch (error) {
      console.debug('Failed to pull files:', error);
    } finally {
      setIsPulling(false);
    }
  }, [workbook.id, router]);

  const handlePublishAll = useCallback(async () => {
    if (!confirm('Are you sure you want to publish all changes?')) return;

    setIsPublishing(true);
    try {
      // Get unique folder names from dirty files
      const dirtyFolderNames = new Set<string>();
      dirtyFiles.forEach((file) => {
        const folderName = file.path.split('/')[0];
        if (folderName) {
          dirtyFolderNames.add(folderName);
        }
      });

      // Find dataFolderIds for dirty folders
      const dataFolderIds: DataFolderId[] = [];
      dataFolderGroups.forEach((group) => {
        group.dataFolders.forEach((folder) => {
          if (dirtyFolderNames.has(folder.name)) {
            dataFolderIds.push(folder.id);
          }
        });
      });

      if (dataFolderIds.length > 0) {
        await dataFolderApi.publish(dataFolderIds, workbook.id);
      }

      router.refresh();
    } catch (error) {
      console.debug('Failed to publish changes:', error);
    } finally {
      setIsPublishing(false);
    }
  }, [workbook.id, router, dirtyFiles, dataFolderGroups]);

  const handleDiscardAll = useCallback(async () => {
    if (!confirm('Are you sure you want to discard all unpublished changes? This cannot be undone.')) return;

    setIsDiscarding(true);
    try {
      await workbookApi.discardChanges(workbook.id);
      router.refresh();
    } catch (error) {
      console.debug('Failed to discard changes:', error);
    } finally {
      setIsDiscarding(false);
    }
  }, [workbook.id, router]);

  const fetchDirtyFiles = useCallback(async () => {
    if (mode !== 'review') return;
    setDirtyFilesLoading(true);
    try {
      const data = (await workbookApi.getStatus(workbook.id)) as DirtyFile[];
      setDirtyFiles(data || []);
    } catch (error) {
      console.debug('Failed to fetch dirty files:', error);
    } finally {
      setDirtyFilesLoading(false);
    }
  }, [workbook.id, mode]);

  useEffect(() => {
    fetchDirtyFiles();
  }, [fetchDirtyFiles]);

  // Create a set of dirty file paths for quick lookup
  const dirtyFilePaths = useMemo(() => {
    return new Set(dirtyFiles.map((f) => f.path));
  }, [dirtyFiles]);

  // Sort groups: Scratch first, then alphabetically by name
  const sortedGroups = useMemo(
    () =>
      [...dataFolderGroups].sort((a, b) => {
        if (a.name === SCRATCH_GROUP_NAME) return -1;
        if (b.name === SCRATCH_GROUP_NAME) return 1;
        return a.name.localeCompare(b.name);
      }),
    [dataFolderGroups],
  );

  // Create a map from connectorAccountId to ConnectorAccount for fast lookup
  const connectorAccountMap = useMemo(() => {
    const map = new Map<string, ConnectorAccount>();
    connectorAccounts?.forEach((account) => {
      map.set(account.id, account);
    });
    return map;
  }, [connectorAccounts]);

  // Find connector accounts that don't have any data folders yet
  const emptyConnectorAccounts = useMemo(() => {
    if (!connectorAccounts) return [];

    // Get the set of connector account IDs that have data folders
    const connectorIdsWithFolders = new Set<string>();
    dataFolderGroups.forEach((group) => {
      group.dataFolders.forEach((folder) => {
        if (folder.connectorAccountId) {
          connectorIdsWithFolders.add(folder.connectorAccountId);
        }
      });
    });

    // Return connector accounts that don't have any data folders
    return connectorAccounts.filter((account) => !connectorIdsWithFolders.has(account.id));
  }, [connectorAccounts, dataFolderGroups]);

  // Auto-expand all connection nodes on initial load
  useEffect(() => {
    if ((sortedGroups.length > 0 || emptyConnectorAccounts.length > 0) && expandedNodes.size === 0) {
      const allConnectionIds = [
        ...sortedGroups.map((group) => `connection-${group.name}`),
        ...emptyConnectorAccounts.map((account) => `connection-${account.displayName || account.id}`),
      ];
      expandAll(allConnectionIds);
    }
  }, [sortedGroups, emptyConnectorAccounts, expandedNodes.size, expandAll]);

  const hasAnyConnections = sortedGroups.length > 0 || emptyConnectorAccounts.length > 0;

  if (isLoading && dataFolderGroups.length === 0) {
    return (
      <Box p="md">
        <Box c="dimmed" fz="sm">
          Loading...
        </Box>
      </Box>
    );
  }

  if (!hasAnyConnections && mode === 'files') {
    return (
      <>
        <Box p="md">
          <Box c="dimmed" fz="sm">
            No connections yet
          </Box>
          <UnstyledButton
            onClick={openConnectionModal}
            mt="sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <StyledLucideIcon Icon={PlusIcon} size="sm" c="var(--mantine-color-blue-6)" />
            <Text12Regular c="var(--mantine-color-blue-6)">New Connection</Text12Regular>
          </UnstyledButton>
        </Box>
        <CreateConnectionModal
          opened={connectionModalOpened}
          onClose={handleConnectionModalClose}
          workbookId={workbook.id}
          returnUrl={`/workbook/${workbook.id}/files`}
        />
      </>
    );
  }

  // In review mode, show empty state if no dirty files
  if (mode === 'review' && !dirtyFilesLoading && dirtyFiles.length === 0) {
    return (
      <Box p="md">
        <Box c="dimmed" fz="sm">
          No unpublished changes
        </Box>
      </Box>
    );
  }

  return (
    <>
      <ScrollArea h="100%" type="auto" offsetScrollbars>
        <Stack gap={0} py="xs">
          {/* Section title */}
          <Box px="sm" py={4} mb={4}>
            <Group justify="space-between" align="center">
              <Text12Regular c="var(--fg-muted)" style={{ textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.5px' }}>
                {mode === 'review' ? 'Edited files' : 'All files'}
              </Text12Regular>
              <UnstyledButton
                onClick={() => {
                  if (mode === 'review') {
                    fetchDirtyFiles();
                  } else {
                    refreshDataFolders();
                  }
                }}
                style={{ opacity: 0.4, padding: 2 }}
                title="Refresh"
              >
                <RefreshCwIcon size={12} />
              </UnstyledButton>
            </Group>

            {/* Publish/Discard buttons for review mode */}
            {mode === 'review' && dirtyFiles.length > 0 && (
              <Group gap={6} mt={8}>
                <ButtonCompactPrimary
                  leftSection={<CloudUploadIcon size={10} />}
                  onClick={handlePublishAll}
                  loading={isPublishing}
                >
                  Publish all
                </ButtonCompactPrimary>
                <ButtonCompactDanger
                  leftSection={<RotateCcwIcon size={10} />}
                  onClick={handleDiscardAll}
                  loading={isDiscarding}
                >
                  Discard all
                </ButtonCompactDanger>
              </Group>
            )}

            {/* Connect new service and Pull all buttons for files mode */}
            {mode === 'files' && (
              <Group gap={6} mt={8}>
                <ButtonCompactSecondary
                  leftSection={<PlusIcon size={10} />}
                  onClick={openConnectionModal}
                >
                  Connect new service
                </ButtonCompactSecondary>
                <ButtonCompactSecondary
                  leftSection={<DownloadIcon size={10} />}
                  onClick={handlePullAll}
                  loading={isPulling}
                >
                  Pull all
                </ButtonCompactSecondary>
              </Group>
            )}
          </Box>

          {/* Data folder groups (connections with tables) */}
          {sortedGroups.map((group) => {
            // Find the connector account for this group (from first data folder)
            const connectorAccountId = group.dataFolders[0]?.connectorAccountId;
            const connectorAccount = connectorAccountId ? connectorAccountMap.get(connectorAccountId) : undefined;

            return (
              <ConnectionNode
                key={group.name}
                group={group}
                workbookId={workbook.id}
                connectorAccount={connectorAccount}
                mode={mode}
                dirtyFilePaths={dirtyFilePaths}
              />
            );
          })}

          {/* Empty connector accounts (connections without tables yet) */}
          {mode === 'files' &&
            emptyConnectorAccounts.map((account) => (
              <EmptyConnectionNode
                key={account.id}
                connectorAccount={account}
                workbookId={workbook.id}
              />
            ))}
        </Stack>
      </ScrollArea>

      {/* Create Connection Modal */}
      <CreateConnectionModal
        opened={connectionModalOpened}
        onClose={handleConnectionModalClose}
        workbookId={workbook.id}
        returnUrl={`/workbook/${workbook.id}/files`}
      />
    </>
  );
}
