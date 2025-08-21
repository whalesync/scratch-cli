'use client';

import { styleGuideApi } from '@/lib/api/style-guide';
import { CreateStyleGuideDto, StyleGuide, UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { Alert, Checkbox, Group, Modal, ModalProps, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './base/buttons';

interface EditResourceModalProps extends ModalProps {
  resourceDocument: StyleGuide | null;
  onSuccess?: (updatedStyleGuide: StyleGuide, isNewResource: boolean) => void;
}

export function EditResourceModal({ resourceDocument, onSuccess, ...props }: EditResourceModalProps) {
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

    if (resourceDocument) {
      setContent(resourceDocument.body);
      setName(resourceDocument.name);
      setAutoInclude(resourceDocument.autoInclude);
      setResetInputFocus(true);
    } else {
      setName('');
      setContent('');
      setAutoInclude(false);
    }
  }, [resourceDocument, props.opened]);

  useEffect(() => {
    // Focus on textarea when modal opens or style guide changes
    if (resetInputFocus && textareaRef.current) {
      textareaRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  const isNewResource = !resourceDocument;

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
          tags: [],
        };
        updatedStyleGuide = await styleGuideApi.create(newData);
      } else {
        const updateData: UpdateStyleGuideDto = {
          body: content,
          autoInclude,
          tags: [],
        };
        updatedStyleGuide = await styleGuideApi.update(resourceDocument.id, updateData);
      }

      onSuccess?.(updatedStyleGuide, isNewResource);
      notifications.show({
        message: isNewResource ? `Successfully created resource.` : `Successfully updated resource.`,
        color: 'green',
      });
      props.onClose?.();
    } catch (err) {
      setError('Failed to update resource');
      console.error('Error updating resource:', err);
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
      title={resourceDocument ? `Edit ${resourceDocument.name}` : 'Create a new resource'}
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
            placeholder="Enter resource name"
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
          label="Auto include in agent conversations"
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
