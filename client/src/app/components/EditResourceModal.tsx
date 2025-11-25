'use client';

import { SWR_KEYS } from '@/lib/api/keys';
import { styleGuideApi } from '@/lib/api/style-guide';
import { trackClickDownloadResource } from '@/lib/posthog';
import {
  CreateStyleGuideDto,
  DEFAULT_CONTENT_TYPE,
  ResourceContentType,
  StyleGuide,
  UpdateStyleGuideDto,
} from '@/types/server-entities/style-guide';
import { Alert, Checkbox, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CircleCheckBigIcon, CircleXIcon, DownloadIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from './base/buttons';
import { ToolIconButton } from './ToolIconButton';

interface EditResourceModalProps {
  opened: boolean;
  close: (result: { asset: StyleGuide; action: 'create' | 'update' } | null) => void;
  asset: StyleGuide | null;
}

export function EditResourceModal({ opened, close, asset }: EditResourceModalProps) {
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
    if (!opened) {
      return;
    }

    if (asset) {
      setContent(asset.body);
      setName(asset.name);
      setAutoInclude(asset.autoInclude);
      setSourceUrl(asset.sourceUrl || '');
      setContentType(asset.contentType);
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
  }, [asset, opened]);

  useEffect(() => {
    // Focus on textarea when modal opens or style guide changes
    if (resetInputFocus && textareaRef.current) {
      textareaRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  const isNewResource = !asset;

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
        updatedStyleGuide = await styleGuideApi.update(asset.id, updateData);
      }
      await mutate(SWR_KEYS.styleGuides.detail(updatedStyleGuide.id));
      await mutate(SWR_KEYS.styleGuides.list());

      notifications.show({
        message: isNewResource ? `Successfully created resource.` : `Successfully updated resource.`,
        color: 'green',
      });
      close({ asset: updatedStyleGuide, action: isNewResource ? 'create' : 'update' });
    } catch (err) {
      setError('Failed to update resource');
      console.error('Error updating resource:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      close(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => close(null)}
      title={asset ? `Edit ${asset.name}` : 'Create a new prompt asset'}
      size="xl"
      closeOnClickOutside={!isSaving}
      closeOnEscape={!isSaving}
    >
      <Stack gap="md">
        {error && (
          <Alert
            color="red"
            variant="light"
            withCloseButton
            onClose={() => setError(null)}
            icon={<CircleXIcon size={20} />}
          >
            {error}
          </Alert>
        )}
        {contentUpdatedMessage && (
          <Alert
            color="green"
            variant="light"
            icon={<CircleCheckBigIcon size={20} />}
            withCloseButton
            onClose={() => setContentUpdatedMessage(null)}
          >
            {contentUpdatedMessage}
          </Alert>
        )}

        {isNewResource && (
          <TextInput
            placeholder="Enter name"
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
            description="Optional. If provided, the content will be downloaded from the URL"
            inputWrapperOrder={['label', 'input', 'description']}
            flex={1}
          />
          <ToolIconButton
            size="lg"
            onClick={handleDownloadResource}
            loading={isSaving}
            icon={DownloadIcon}
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
          <ButtonSecondaryOutline onClick={handleClose} disabled={isSaving}>
            Cancel
          </ButtonSecondaryOutline>
          <ButtonPrimaryLight loading={isSaving} disabled={!name.trim()} onClick={handleSubmit}>
            {isNewResource ? 'Create' : 'Save'}
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
}

export const useEditResourceModal = () => {
  const [opened, setOpened] = useState(false);
  const [asset, setAsset] = useState<StyleGuide | null>(null);

  const open = (resource: StyleGuide | 'new') => {
    if (resource === 'new') {
      setAsset(null);
    } else {
      setAsset(resource);
    }
    setOpened(true);
  };

  const close = () => {
    setOpened(false);
    setAsset(null);
  };

  return {
    opened,
    open,
    close,
    asset,
    setAsset,
  };
};
