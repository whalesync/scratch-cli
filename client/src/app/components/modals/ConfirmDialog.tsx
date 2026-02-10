'use client';

import { Group, Modal, Stack } from '@mantine/core';
import { ReactNode, useCallback, useState } from 'react';
import { ButtonDangerLight, ButtonPrimaryLight, ButtonSecondaryOutline } from '../base/buttons';
import { Text13Regular } from '../base/text';

export type ConfirmDialogVariant = 'primary' | 'danger';

interface ConfirmDialogProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
}

/**
 * A standard confirmation dialog that supports both primary (OK) and danger (delete/destructive) styles.
 *
 * Usage:
 * ```tsx
 * const { opened, open, onClose, dialogProps } = useConfirmDialog();
 *
 * const handleDelete = () => {
 *   open({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item? This cannot be undone.',
 *     confirmLabel: 'Delete',
 *     variant: 'danger',
 *     onConfirm: async () => {
 *       await deleteItem();
 *     },
 *   });
 * };
 *
 * return <ConfirmDialog {...dialogProps} />;
 * ```
 */
export const ConfirmDialog = ({
  opened,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
}: ConfirmDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const ConfirmButton = variant === 'danger' ? ButtonDangerLight : ButtonPrimaryLight;

  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="sm">
      <Stack gap="md">
        {typeof message === 'string' ? <Text13Regular>{message}</Text13Regular> : message}

        <Group justify="flex-end" mt="md">
          <ButtonSecondaryOutline onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </ButtonSecondaryOutline>
          <ConfirmButton onClick={handleConfirm} loading={isLoading}>
            {confirmLabel}
          </ConfirmButton>
        </Group>
      </Stack>
    </Modal>
  );
};

interface UseConfirmDialogOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => Promise<void> | void;
}

interface UseConfirmDialogReturn {
  opened: boolean;
  open: (options: UseConfirmDialogOptions) => void;
  onClose: () => void;
  dialogProps: ConfirmDialogProps;
}

/**
 * Hook for managing confirm dialog state.
 *
 * Example:
 * ```tsx
 * const { open, dialogProps } = useConfirmDialog();
 *
 * const handlePublish = () => {
 *   open({
 *     title: 'Publish Changes',
 *     message: 'Are you sure you want to publish all changes?',
 *     confirmLabel: 'Publish',
 *     variant: 'primary',
 *     onConfirm: async () => {
 *       await publishChanges();
 *     },
 *   });
 * };
 *
 * return (
 *   <>
 *     <Button onClick={handlePublish}>Publish</Button>
 *     <ConfirmDialog {...dialogProps} />
 *   </>
 * );
 * ```
 */
export const useConfirmDialog = (): UseConfirmDialogReturn => {
  const [opened, setOpened] = useState(false);
  const [options, setOptions] = useState<UseConfirmDialogOptions | null>(null);

  const open = useCallback((opts: UseConfirmDialogOptions) => {
    setOptions(opts);
    setOpened(true);
  }, []);

  const onClose = useCallback(() => {
    setOpened(false);
    // Don't clear options immediately to prevent content flashing while closing
    setTimeout(() => setOptions(null), 200);
  }, []);

  const dialogProps: ConfirmDialogProps = {
    opened,
    onClose,
    title: options?.title ?? '',
    message: options?.message ?? '',
    confirmLabel: options?.confirmLabel,
    cancelLabel: options?.cancelLabel,
    variant: options?.variant ?? 'primary',
    onConfirm: options?.onConfirm ?? (() => {}),
  };

  return {
    opened,
    open,
    onClose,
    dialogProps,
  };
};
