'use client';

import { useConnectorAccounts } from '@/hooks/use-connector-account';
import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import type { ConnectorAccount, WorkbookId } from '@spinner/shared-types';
import { useState } from 'react';

interface RemoveConnectionModalProps {
  opened: boolean;
  onClose: () => void;
  connectorAccount: ConnectorAccount;
  workbookId: WorkbookId;
  onSuccess?: () => void;
}

export function RemoveConnectionModal({
  opened,
  onClose,
  connectorAccount,
  workbookId,
  onSuccess,
}: RemoveConnectionModalProps) {
  const { deleteConnectorAccount } = useConnectorAccounts(workbookId);
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    setLoading(true);
    try {
      await deleteConnectorAccount(connectorAccount.id);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to remove connection:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Remove Connection" size="sm" centered>
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to remove the connection &quot;{connectorAccount.displayName}&quot;?
          This will also remove all linked tables and their local data.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={handleRemove} loading={loading}>
            Remove
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
