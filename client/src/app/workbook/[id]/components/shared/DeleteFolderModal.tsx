'use client';

import {
  Button,
  Group,
  Modal,
  Stack,
  Text,
} from '@mantine/core';
import type { DataFolder } from '@spinner/shared-types';
import { useState } from 'react';

interface DeleteFolderModalProps {
  opened: boolean;
  onClose: () => void;
  folder: DataFolder;
  onConfirm: () => Promise<void>;
}

export function DeleteFolderModal({ opened, onClose, folder, onConfirm }: DeleteFolderModalProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Delete Folder" size="sm" centered>
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to delete &quot;{folder.name}&quot;? This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={handleDelete} loading={loading}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
