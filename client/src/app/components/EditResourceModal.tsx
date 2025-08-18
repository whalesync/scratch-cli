'use client';

import { styleGuideApi } from '@/lib/api/style-guide';
import { CreateStyleGuideDto, StyleGuide, UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { Alert, Checkbox, Group, Modal, ModalProps, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './base/buttons';

interface EditResourceModalProps extends ModalProps {
  styleGuide?: StyleGuide | null;
  onSuccess?: (updatedStyleGuide: StyleGuide, isNewResource: boolean) => void;
}

export function EditResourceModal({ styleGuide, onSuccess, ...props }: EditResourceModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [autoInclude, setAutoInclude] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);

  useEffect(() => {
    if (!props.opened) {
      return;
    }

    if (styleGuide) {
      setContent(styleGuide.body);
      setName(styleGuide.name);
      setAutoInclude(styleGuide.autoInclude);
      setResetInputFocus(true);
    } else {
      setName('');
      setContent('');
      setAutoInclude(false);
    }
  }, [styleGuide, props.opened]);

  useEffect(() => {
    // Focus on textarea when modal opens or style guide changes
    if (resetInputFocus && textareaRef.current) {
      textareaRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  const isNewResource = !styleGuide;

  const handleSubmit = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      let updatedStyleGuide: StyleGuide;

      if (isNewResource) {
        const newData: CreateStyleGuideDto = {
          name: name.trim(),
          body: content,
          autoInclude,
        };
        updatedStyleGuide = await styleGuideApi.create(newData);
      } else {
        const updateData: UpdateStyleGuideDto = {
          body: content,
          autoInclude,
        };
        updatedStyleGuide = await styleGuideApi.update(styleGuide.id, updateData);
      }

      onSuccess?.(updatedStyleGuide, isNewResource);
      notifications.show({
        message: isNewResource ? `Successfully created resource.` : `Successfully updated resource.`,
        color: 'green',
      });
      props.onClose?.();
    } catch (err) {
      setError('Failed to update style guide');
      console.error('Error updating style guide:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    if (!isUpdating) {
      props.onClose?.();
    }
  };

  return (
    <Modal
      title={styleGuide ? `Edit ${styleGuide.name}` : 'Create a new resource'}
      size="xl"
      closeOnClickOutside={!isUpdating}
      closeOnEscape={!isUpdating}
      {...props}
    >
      <Stack gap="md">
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {isNewResource && (
          <TextInput
            placeholder="Enter style guide name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isUpdating}
          />
        )}

        <Textarea
          ref={textareaRef}
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minRows={20}
          autosize
        />

        <Checkbox
          label="Auto include in conversations"
          checked={autoInclude}
          onChange={(e) => setAutoInclude(e.target.checked)}
          disabled={isUpdating}
        />

        <Group justify="flex-end" gap="sm">
          <SecondaryButton onClick={handleClose} disabled={isUpdating}>
            Cancel
          </SecondaryButton>
          <PrimaryButton loading={isUpdating} disabled={!name.trim()} onClick={handleSubmit}>
            {isNewResource ? 'Create' : 'Save'}
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
}
