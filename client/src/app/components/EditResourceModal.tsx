'use client';

import { styleGuideApi } from '@/lib/api/style-guide';
import { trackClickDownloadResource } from '@/lib/posthog';
import {
  CreateStyleGuideDto,
  DEFAULT_CONTENT_TYPE,
  ResourceContentType,
  StyleGuide,
  UpdateStyleGuideDto,
} from '@/types/server-entities/style-guide';
import { Alert, Checkbox, Group, Modal, ModalProps, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CheckCircleIcon, DownloadSimpleIcon, XCircleIcon } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { PrimaryButton, SecondaryButton } from './base/buttons';
import { ToolIconButton } from './ToolIconButton';

interface EditResourceModalProps extends ModalProps {
  resourceDocument: StyleGuide | null;
  onSuccess?: (updatedStyleGuide: StyleGuide, isNewResource: boolean) => void;
}

export function EditResourceModal({ resourceDocument, onSuccess, ...props }: EditResourceModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [contentType, setContentType] = useState<ResourceContentType>(DEFAULT_CONTENT_TYPE);
  const [contentUpdatedMessage, setContentUpdatedMessage] = useState<string | null>(null);
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
      setSourceUrl(resourceDocument.sourceUrl || '');
      setContentType(resourceDocument.contentType);
      setResetInputFocus(true);
    } else {
      setName('');
      setContent('');
      setAutoInclude(false);
      setSourceUrl('');
      setContentType(DEFAULT_CONTENT_TYPE);
    }

    setError(null);
    setIsSaving(false);
    setContentUpdatedMessage(null);
  }, [resourceDocument, props.opened]);

  useEffect(() => {
    // Focus on textarea when modal opens or style guide changes
    if (resetInputFocus && textareaRef.current) {
      textareaRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  const isNewResource = !resourceDocument;

  const handleDownloadResource = async () => {
    trackClickDownloadResource();
    setIsSaving(true);
    setError(null);
    setContentUpdatedMessage(null);

    try {
      const externalContent = await styleGuideApi.downloadResource(sourceUrl);
      setContentType(externalContent.contentType);
      setContent(externalContent.content);
      setContentUpdatedMessage(`Resource content downloaded successfully`);
    } catch (err) {
      setError(`Failed to download resource: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.log('Error downloading resource:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    setError(null);
    setContentUpdatedMessage(null);

    const cleanedSourceUrl = sourceUrl ? sourceUrl.trim() : undefined;

    try {
      let updatedStyleGuide: StyleGuide;

      if (isNewResource) {
        const newData: CreateStyleGuideDto = {
          name: name.trim(),
          body: content,
          autoInclude,
          sourceUrl: cleanedSourceUrl,
          contentType,
          tags: [],
        };
        updatedStyleGuide = await styleGuideApi.create(newData);
      } else {
        const updateData: UpdateStyleGuideDto = {
          body: content,
          autoInclude,
          sourceUrl: cleanedSourceUrl,
          contentType,
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
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      props.onClose?.();
    }
  };

  return (
    <Modal
      title={resourceDocument ? `Edit ${resourceDocument.name}` : 'Create a new resource'}
      size="xl"
      closeOnClickOutside={!isSaving}
      closeOnEscape={!isSaving}
      {...props}
    >
      <Stack gap="md">
        {error && (
          <Alert
            color="red"
            variant="light"
            withCloseButton
            onClose={() => setError(null)}
            icon={<XCircleIcon size={20} />}
          >
            {error}
          </Alert>
        )}
        {contentUpdatedMessage && (
          <Alert
            color="green"
            variant="light"
            icon={<CheckCircleIcon size={20} />}
            withCloseButton
            onClose={() => setContentUpdatedMessage(null)}
          >
            {contentUpdatedMessage}
          </Alert>
        )}

        {isNewResource && (
          <TextInput
            placeholder="Enter resource name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
          />
        )}

        <Textarea
          ref={textareaRef}
          label="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          minRows={20}
          maxRows={20}
          autosize
          disabled={isSaving}
        />

        <Group gap="xs">
          <TextInput
            label="Source URL"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            disabled={isSaving}
            description="Optional. If provided, the resource will be downloaded from the URL and used as the content."
            inputWrapperOrder={['label', 'input', 'description']}
            flex={1}
          />
          <ToolIconButton
            size="lg"
            onClick={handleDownloadResource}
            loading={isSaving}
            icon={DownloadSimpleIcon}
            tooltip="Download from source"
          />
        </Group>

        <Checkbox
          label="Auto include in agent conversations"
          checked={autoInclude}
          onChange={(e) => setAutoInclude(e.target.checked)}
          disabled={isSaving}
        />

        <Group justify="flex-end" gap="sm">
          <SecondaryButton onClick={handleClose} disabled={isSaving}>
            Cancel
          </SecondaryButton>
          <PrimaryButton loading={isSaving} disabled={!name.trim()} onClick={handleSubmit}>
            {isNewResource ? 'Create' : 'Save'}
          </PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
}
