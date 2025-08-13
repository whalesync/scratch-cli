'use client';

import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useSnapshots } from '@/hooks/use-snapshot';
import { connectorAccountsApi } from '@/lib/api/connector-accounts';
import { ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { TablePreview } from '@/types/server-entities/table-list';
import { RouteUrls } from '@/utils/route-urls';
import {
  Button,
  Center,
  Checkbox,
  Group,
  Loader,
  Modal,
  ModalProps,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface CreateSnapshotModalProps extends ModalProps {
  connectorAccount: ConnectorAccount;
}

export const CreateSnapshotModal = ({ connectorAccount, ...props }: CreateSnapshotModalProps) => {
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tables, setTables] = useState<TablePreview[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { createSnapshot } = useSnapshots(connectorAccount.id);

  useEffect(() => {
    if (props.opened) {
      setIsLoadingTables(true);
      setError(null);
      connectorAccountsApi
        .listTables(connectorAccount.id)
        .then((data) => setTables(data.tables))
        .catch((e) => setError(e.message ?? 'An unknown error occurred'))
        .finally(() => setIsLoadingTables(false));
    } else {
      // Clear state when modal is closed
      setTables([]);
      setSelectedTables([]);
      setError(null);
    }
  }, [props.opened, connectorAccount.id]);

  const handleCreateSnapshot = async () => {
    // We are storing the wsId in selectedTables. Find the full EntityId
    const tableIds = tables.filter((t) => selectedTables.includes(t.id.wsId)).map((t) => t.id);

    if (tableIds.length === 0) {
      setError('Please select at least one table');
      return;
    }
    setIsSaving(true);
    try {
      const snapshot = await createSnapshot({
        connectorAccountId: connectorAccount.id,
        tableIds: tableIds,
        name: snapshotName ?? `New ${connectorAccount.displayName} snapshot`,
      });
      props.onClose?.();
      await router.push(RouteUrls.snapshotPage(snapshot.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal title="Start new snapshot" size="xl" centered {...props}>
      <Stack>
        <TextInput
          placeholder="Enter a name for the snapshot"
          required
          value={snapshotName}
          onChange={(e) => setSnapshotName(e.target.value)}
        />
        {isLoadingTables ? (
          <Center mih={200}>
            <Group gap="sm">
              <Loader />
              <Text>Loading tables...</Text>
            </Group>
          </Center>
        ) : error ? (
          <Text c="red">{error}</Text>
        ) : (
          <Checkbox.Group value={selectedTables} onChange={setSelectedTables}>
            <Group justify="flex-start">
              <Text size="sm">Select tables to include in the snapshot</Text>
              <Group gap="xs" ml="auto">
                <Button variant="subtle" size="xs" onClick={() => setSelectedTables(tables.map((t) => t.id.wsId))}>
                  Select all
                </Button>
                <Button variant="subtle" size="xs" onClick={() => setSelectedTables([])}>
                  Select none
                </Button>
              </Group>
            </Group>

            <Paper withBorder p="md" mt="sm">
              <ScrollArea h={400}>
                <Stack mt="xs">
                  {tables
                    .sort((a, b) => a.displayName.localeCompare(b.displayName))
                    .map((table) => (
                      <Checkbox
                        key={`${table.id.wsId}-${table.displayName}`}
                        value={table.id.wsId}
                        label={table.displayName}
                      />
                    ))}
                </Stack>
              </ScrollArea>
            </Paper>
          </Checkbox.Group>
        )}

        <Group justify="flex-end">
          <SecondaryButton onClick={props.onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            loading={isSaving}
            onClick={handleCreateSnapshot}
            disabled={selectedTables.length === 0 || snapshotName.length === 0 || !!error}
          >
            Create snapshot
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
