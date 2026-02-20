'use client';

import { useDataFolders } from '@/hooks/use-data-folders';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { DataFolder, WorkbookId } from '@spinner/shared-types';
import { useState } from 'react';

interface RemoveTableModalProps {
  opened: boolean;
  onClose: () => void;
  folder: DataFolder;
  workbookId: WorkbookId;
  onSuccess?: () => void;
}

export function RemoveTableModal({ opened, onClose, folder, workbookId, onSuccess }: RemoveTableModalProps) {
  const { deleteFolder } = useDataFolders(workbookId);
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    setLoading(true);
    try {
      await deleteFolder(folder.id);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to remove table:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Unlink Table" size="sm" centered>
      <Stack gap="md">
        <Text size="sm">
          Are you sure you want to unlink &quot;{folder.name}&quot; from this workspace? This table will be removed from
          your scratchpad along with any pending changes, but the remote files will not be affected. You can relink this
          table in the future if needed.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={handleRemove} loading={loading}>
            Unlink
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
