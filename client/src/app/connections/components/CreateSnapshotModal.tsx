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
import { useDisclosure } from '@mantine/hooks';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface CreateSnapshotModalProps extends ModalProps {
  connectorAccount: ConnectorAccount;
}

export const CreateSnapshotModal = ({
  connectorAccount: initialConnectorAccount,
  ...props
}: CreateSnapshotModalProps) => {
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tables, setTables] = useState<TablePreview[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectorAccount, setConnectorAccount] = useState(initialConnectorAccount);
  const router = useRouter();

  // Add channel modal state
  const [addChannelModalOpened, { open: openAddChannelModal, close: closeAddChannelModal }] = useDisclosure(false);
  const [channelId, setChannelId] = useState<string>('');
  const [isAddingChannel, setIsAddingChannel] = useState(false);

  const { createSnapshot } = useSnapshots(connectorAccount.id);

  // Update local state when prop changes
  useEffect(() => {
    setConnectorAccount(initialConnectorAccount);
  }, [initialConnectorAccount]);

  const loadTables = useCallback(async () => {
    setIsLoadingTables(true);
    setError(null);
    try {
      const data = await connectorAccountsApi.listTables(connectorAccount.id);
      setTables(data.tables);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
    } finally {
      setIsLoadingTables(false);
    }
  }, [connectorAccount.id]);

  useEffect(() => {
    if (props.opened) {
      loadTables();
    } else {
      // Clear state when modal is closed
      setTables([]);
      setSelectedTables([]);
      setError(null);
    }
  }, [props.opened, loadTables]);

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
        name: snapshotName ?? `New ${connectorAccount.displayName} scratchpaper`,
      });
      props.onClose?.();
      await router.push(RouteUrls.snapshotPage(snapshot.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddChannel = async () => {
    if (!channelId.trim()) return;

    setIsAddingChannel(true);
    try {
      // Get current extras or create new object
      const currentExtras = connectorAccount.extras || {};
      const additionalChannels = Array.isArray(currentExtras.additionalChannels)
        ? currentExtras.additionalChannels
        : [];

      // Add the new channel ID if it's not already present
      if (!additionalChannels.includes(channelId.trim())) {
        const updatedExtras = {
          ...currentExtras,
          additionalChannels: [...additionalChannels, channelId.trim()],
        };

        // Update the connector account
        const updatedAccount = await connectorAccountsApi.update(connectorAccount.id, { extras: updatedExtras });

        // Update local state with the new extras
        setConnectorAccount((prev) => ({
          ...prev,
          extras: updatedAccount.extras,
        }));

        // Refresh the tables to include the new channel
        await loadTables();

        // Close modal and reset form
        closeAddChannelModal();
        setChannelId('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add channel');
    } finally {
      setIsAddingChannel(false);
    }
  };

  return (
    <Modal title="Start new scratchpaper" size="xl" centered {...props}>
      <Stack>
        <TextInput
          placeholder="Enter a name for the scratchpaper"
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
              <Text size="sm">Select tables to include in the scratchpaper</Text>
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

        {/* Add Channel button for YouTube connections */}
        {connectorAccount.service === 'YOUTUBE' && (
          <Group justify="flex-start" mt="sm">
            <Button variant="outline" size="sm" onClick={openAddChannelModal} disabled={isLoadingTables}>
              Add Channel
            </Button>
          </Group>
        )}

        <Group justify="flex-end">
          <SecondaryButton onClick={props.onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            loading={isSaving}
            onClick={handleCreateSnapshot}
            disabled={selectedTables.length === 0 || snapshotName.length === 0 || !!error}
          >
            Create scratchpaper
          </PrimaryButton>
        </Group>
      </Stack>

      {/* Add Channel Modal */}
      <Modal
        title="Add YouTube Channel"
        opened={addChannelModalOpened}
        onClose={closeAddChannelModal}
        centered
        size="sm"
      >
        <Stack>
          <TextInput
            label="Channel ID"
            placeholder="Enter YouTube channel ID"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            required
          />
          <Text size="sm" c="dimmed">
            You can find the channel ID in the YouTube channel URL or channel settings.
          </Text>
          <Group justify="flex-end">
            <SecondaryButton onClick={closeAddChannelModal}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleAddChannel} loading={isAddingChannel} disabled={!channelId.trim()}>
              Add Channel
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
    </Modal>
  );
};
