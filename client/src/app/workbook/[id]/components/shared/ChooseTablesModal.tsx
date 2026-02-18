'use client';

import { Text13Regular } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { useDataFolders } from '@/hooks/use-data-folders';
import { useWorkbook } from '@/hooks/use-workbook';
import { connectorAccountsApi } from '@/lib/api/connector-accounts';
import { dataFolderApi } from '@/lib/api/data-folder';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { TableList, TablePreview } from '@/types/server-entities/table-list';
import { Alert, Button, Checkbox, Group, List, Loader, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import type { ConnectorAccount, DataFolderId, WorkbookId } from '@spinner/shared-types';
import { AlertTriangleIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

interface ChooseTablesModalProps {
  opened: boolean;
  onClose: () => void;
  workbookId: WorkbookId;
  connectorAccount: ConnectorAccount;
}

export function ChooseTablesModal({ opened, onClose, workbookId, connectorAccount }: ChooseTablesModalProps) {
  const { data, isLoading, isValidating } = useSWR<TableList>(
    opened ? SWR_KEYS.connectorAccounts.tables(workbookId, connectorAccount.id) : null,
    () => connectorAccountsApi.listTables(workbookId, connectorAccount.id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );
  const availableTables = data?.tables || [];
  const tablesLoading = isLoading || (isValidating && availableTables.length === 0);

  const { dataFolderGroups, refresh: refreshDataFolders } = useDataFolders();
  const { addLinkedDataFolder } = useWorkbook(workbookId);

  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [foldersToRemove, setFoldersToRemove] = useState<{ id: DataFolderId; name: string; tableId: string[] }[]>([]);
  const [dirtyFileCount, setDirtyFileCount] = useState(0);

  // Get currently linked data folders for this connector account
  const linkedFolders = useMemo(() => {
    const folders: { id: DataFolderId; name: string; tableId: string[] }[] = [];
    dataFolderGroups.forEach((group) => {
      group.dataFolders.forEach((folder) => {
        if (folder.connectorAccountId === connectorAccount.id) {
          folders.push({ id: folder.id, name: folder.name, tableId: folder.tableId });
        }
      });
    });
    return folders;
  }, [dataFolderGroups, connectorAccount.id]);

  // Initialize selected tables based on currently linked folders
  useEffect(() => {
    if (opened) {
      const linked = new Set<string>();
      linkedFolders.forEach((folder) => {
        if (folder.tableId.length > 0) {
          linked.add(folder.tableId.join('/'));
        }
      });
      setSelectedTableIds(linked);
    }
  }, [opened, linkedFolders]);

  const handleToggleTable = (table: TablePreview) => {
    const tableKey = table.id.remoteId.join('/');
    setSelectedTableIds((prev) => {
      const next = new Set(prev);
      if (next.has(tableKey)) {
        next.delete(tableKey);
      } else {
        next.add(tableKey);
      }
      return next;
    });
  };

  const handleSave = async () => {
    // Determine which tables to add and which to remove
    const currentlyLinkedKeys = new Set(linkedFolders.map((f) => f.tableId.join('/')));

    // Tables to add: selected but not currently linked
    const tablesToAdd = availableTables.filter((table) => {
      const tableKey = table.id.remoteId.join('/');
      return selectedTableIds.has(tableKey) && !currentlyLinkedKeys.has(tableKey);
    });

    // Tables to remove: currently linked but not selected
    const pendingFoldersToRemove = linkedFolders.filter((folder) => {
      const folderKey = folder.tableId.join('/');
      return !selectedTableIds.has(folderKey);
    });

    // If there are folders to remove, check for dirty files and show confirmation
    if (pendingFoldersToRemove.length > 0 && !showConfirmation) {
      try {
        // Get dirty files from workbook status
        const dirtyFiles = (await workbookApi.getStatus(workbookId)) as { path: string }[];

        // Count dirty files in folders being removed
        const folderNames = new Set(pendingFoldersToRemove.map((f) => f.name));
        const dirtyInRemovedFolders = dirtyFiles.filter((file) => {
          // Check if file path starts with any of the folder names
          return Array.from(folderNames).some(
            (folderName) => file.path.startsWith(`${folderName}/`) || file.path.includes(`/${folderName}/`),
          );
        });

        setFoldersToRemove(pendingFoldersToRemove);
        setDirtyFileCount(dirtyInRemovedFolders.length);
        setShowConfirmation(true);
        return;
      } catch (error) {
        console.error('Failed to check dirty files:', error);
        // Continue with removal even if check fails
      }
    }

    setIsSaving(true);
    try {
      // Add new tables
      for (const table of tablesToAdd) {
        await addLinkedDataFolder(table.id.remoteId, table.displayName, connectorAccount.id);
      }

      // Remove unselected tables
      const toRemove = showConfirmation ? foldersToRemove : pendingFoldersToRemove;
      for (const folder of toRemove) {
        await dataFolderApi.delete(folder.id);
      }

      // Refresh data folders
      await refreshDataFolders();

      setShowConfirmation(false);
      onClose();
    } catch (error) {
      console.error('Failed to update tables:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
    setFoldersToRemove([]);
    setDirtyFileCount(0);
  };

  const connectionName = connectorAccount.displayName;

  const modalTitle = showConfirmation ? (
    'Confirm removal'
  ) : (
    <Group gap="xs" align="center">
      <ConnectorIcon connector={connectorAccount.service} size={20} p={0} />
      <Text fw={600}>{connectionName}</Text>
    </Group>
  );

  return (
    <Modal opened={opened} onClose={onClose} title={modalTitle} size="md" centered>
      {showConfirmation ? (
        <Stack gap="md">
          <Alert icon={<AlertTriangleIcon size={16} />} color="orange" variant="light">
            <Text size="sm" fw={500} mb="xs">
              These folders will no longer be available in Scratch:
            </Text>
            <List size="sm" spacing={4}>
              {foldersToRemove.map((folder) => (
                <List.Item key={folder.id}>{folder.name}</List.Item>
              ))}
            </List>
            {dirtyFileCount > 0 && (
              <Text size="sm" c="orange" mt="sm" fw={500}>
                There {dirtyFileCount === 1 ? 'is' : 'are'} {dirtyFileCount} file{dirtyFileCount === 1 ? '' : 's'} with
                unpublished changes that will be discarded.
              </Text>
            )}
          </Alert>

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="subtle" color="gray" onClick={handleCancelConfirmation}>
              Go back
            </Button>
            <Button color="red" onClick={handleSave} loading={isSaving}>
              Remove
            </Button>
          </Group>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Pick the tables from {connectionName} to make available in Scratch.
          </Text>

          {tablesLoading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                Loading tables...
              </Text>
            </Group>
          ) : availableTables.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              No tables available for this connection
            </Text>
          ) : (
            <ScrollArea.Autosize mah={400}>
              <Stack gap="xs">
                {availableTables.map((table) => {
                  const tableKey = table.id.remoteId.join('/');
                  const isChecked = selectedTableIds.has(tableKey);

                  return (
                    <Checkbox
                      key={tableKey}
                      label={<Text13Regular>{table.displayName}</Text13Regular>}
                      checked={isChecked}
                      onChange={() => handleToggleTable(table)}
                    />
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>
          )}

          <Group justify="flex-end" gap="sm" mt="md">
            <Button variant="subtle" color="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
