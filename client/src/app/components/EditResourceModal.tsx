'use client';

import { styleGuideApi } from '@/lib/api/style-guide';
import { CreateStyleGuideDto, StyleGuide, UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { Alert, Button, Group, Modal, ModalProps, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useRef, useState } from 'react';

interface EditResourceModalProps extends ModalProps {
  styleGuide?: StyleGuide | null;
  onSuccess?: (updatedStyleGuide: StyleGuide) => void;
}

export function EditResourceModal({ styleGuide, onSuccess, ...props }: EditResourceModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);

  useEffect(() => {
    if (styleGuide) {
      setContent(styleGuide.body);
      setName(styleGuide.name);
      setResetInputFocus(true);
    } else {
      setName('');
      setContent('');
    }
  }, [styleGuide]);

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
        };
        updatedStyleGuide = await styleGuideApi.create(newData);
      } else {
        const updateData: UpdateStyleGuideDto = {
          name: isNewResource ? name.trim() : undefined,
          body: content,
        };
        updatedStyleGuide = await styleGuideApi.update(styleGuide.id, updateData);
      }

      onSuccess?.(updatedStyleGuide);
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

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={handleClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button loading={isUpdating} disabled={!name.trim()} onClick={handleSubmit}>
            {isNewResource ? 'Create' : 'Save'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
