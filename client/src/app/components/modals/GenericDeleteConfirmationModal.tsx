'use client';

import { Group, Modal, Stack } from '@mantine/core';
import { ReactNode, useState } from 'react';
import { ButtonDangerLight, ButtonSecondaryOutline } from '../base/buttons';
import { Text13Regular } from '../base/text';

interface GenericDeleteConfirmationModalProps<T extends string = string> {
  opened: boolean;
  onClose: () => void;
  resourceName: string;
  resourceId: T;
  onConfirm: (id: T) => Promise<void> | void;
  title?: string;
  description?: ReactNode;
}

export const GenericDeleteConfirmationModal = <T extends string = string>({
  opened,
  onClose,
  resourceName,
  resourceId,
  onConfirm,
  title = 'Confirm Deletion',
  description,
}: GenericDeleteConfirmationModalProps<T>) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(resourceId);
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="md">
      <Stack gap="md">
        {description || (
          <>
            <Text13Regular>
              Are you sure you want to delete <strong>{resourceName}</strong>?
            </Text13Regular>
            <Text13Regular>This action cannot be undone.</Text13Regular>
          </>
        )}

        <Group justify="flex-end" mt="md">
          <ButtonSecondaryOutline onClick={onClose} disabled={isDeleting}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonDangerLight onClick={handleDelete} loading={isDeleting}>
            Delete
          </ButtonDangerLight>
        </Group>
      </Stack>
    </Modal>
  );
};

export const useDeleteConfirmationModal = <T extends string = string>() => {
  const [opened, setOpened] = useState(false);
  const [resource, setResource] = useState<{ id: T; name: string } | null>(null);

  const open = (id: T, name: string) => {
    setResource({ id, name });
    setOpened(true);
  };

  const onClose = () => {
    setOpened(false);
    // Don't clear resource immediately to prevent content flashing while closing
    setTimeout(() => setResource(null), 200);
  };

  return {
    opened,
    open,
    onClose,
    // Cast to T to allow convenient usage when T is a branded type.
    // The id should only be consumed when opened is true.
    resourceId: (resource?.id ?? '') as T,
    resourceName: resource?.name ?? '',
  };
};
