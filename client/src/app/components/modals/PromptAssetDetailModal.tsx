'use client';

import { SWR_KEYS } from '@/lib/api/keys';
import { promptAssetApi } from '@/lib/api/prompt-asset';
import { trackClickDownloadResource } from '@/lib/posthog';
import { UpdateStyleGuideDto } from '@/types/server-entities/style-guide';
import { Alert, Checkbox, Group, Modal, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  CreateStyleGuideDto,
  DEFAULT_CONTENT_TYPE,
  ResourceContentType,
  StyleGuide,
  StyleGuideId,
} from '@spinner/shared-types';
import { CircleCheckBigIcon, CircleXIcon, DownloadIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { mutate } from 'swr';
import { ButtonPrimaryLight, ButtonSecondaryOutline, IconButtonOutline } from '../base/buttons';

type InitialValues = { asset: StyleGuide | 'new-text' | 'new-url' };

interface PromptAssetDetailModalProps {
  opened: boolean;
  close: (result: { asset: StyleGuide; action: 'create' | 'update' } | null) => void;
  initialValues: InitialValues | null;
}

interface FormValues {
  id: '' | StyleGuideId;
  isRemote: boolean;
  name: string;
  content: string;
  sourceUrl: string;
  contentType: ResourceContentType;
  autoInclude: boolean;
}

export function PromptAssetDetailModal({ opened, close, initialValues }: PromptAssetDetailModalProps) {
  const form = useForm<FormValues>({
    mode: 'uncontrolled',
    initialValues: {
      id: '',
      name: '',
      content: '',
      sourceUrl: '',
      contentType: DEFAULT_CONTENT_TYPE,
      autoInclude: false,
      isRemote: false,
    },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : 'Name is required'),
      content: (value) => (value.trim().length === 0 ? 'Content is required' : null),
    },
  });

  // Adjust to new initial values.
  useEffect(() => {
    form.reset();

    if (!initialValues) {
      return;
    } else if (initialValues.asset === 'new-text') {
      form.setValues({ isRemote: false });
    } else if (initialValues.asset === 'new-url') {
      form.setValues({ isRemote: true });
    } else {
      form.setValues({
        id: initialValues.asset.id,
        name: initialValues.asset.name,
        content: initialValues.asset.body,
        sourceUrl: initialValues.asset.sourceUrl || '',
        contentType: initialValues.asset.contentType,
        autoInclude: initialValues.asset.autoInclude,
        isRemote: initialValues.asset.sourceUrl !== null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Infinite loop if form is included..
  }, [initialValues]);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentUpdatedMessage, setContentUpdatedMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);

  const isNewAsset = form.values.id === '';
  const isRemote = form.values.isRemote;

  useEffect(() => {
    if (!opened) {
      return;
    }
    setResetInputFocus(true);
    setError(null);
    setIsSaving(false);
    setContentUpdatedMessage(null);
  }, [opened]);

  useEffect(() => {
    // Focus on textarea when modal opens or style guide changes
    if (resetInputFocus && textareaRef.current) {
      textareaRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  const handleDownloadAsset = useCallback(async () => {
    trackClickDownloadResource();
    setIsSaving(true);
    setError(null);
    setContentUpdatedMessage(null);

    const url = form.getValues().sourceUrl;

    try {
      console.log('Downloading asset from URL:', url);
      const externalContent = await promptAssetApi.downloadResource(url);
      form.setFieldValue('contentType', externalContent.contentType);
      form.setFieldValue('content', externalContent.content);
      setContentUpdatedMessage(`Asset content downloaded successfully`);
    } catch (err) {
      setError(`Failed to download asset: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error downloading asset:', err);
    } finally {
      setIsSaving(false);
    }
  }, [form]);

  const handleSubmit = async (values: FormValues) => {
    setIsSaving(true);
    setError(null);
    setContentUpdatedMessage(null);

    const cleanedSourceUrl = values.sourceUrl ? values.sourceUrl.trim() : undefined;

    try {
      let updatedStyleGuide: StyleGuide;

      if (isNewAsset) {
        const newData = new CreateStyleGuideDto();
        newData.name = values.name.trim();
        newData.body = values.content;
        newData.autoInclude = values.autoInclude;
        newData.sourceUrl = cleanedSourceUrl;
        newData.contentType = values.contentType;
        newData.tags = [];
        updatedStyleGuide = await promptAssetApi.create(newData);
      } else {
        const updateData: UpdateStyleGuideDto = {
          body: values.content,
          autoInclude: values.autoInclude,
          sourceUrl: cleanedSourceUrl,
          contentType: values.contentType,
          tags: [],
        };
        updatedStyleGuide = await promptAssetApi.update(form.getValues().id, updateData);
      }
      await mutate(SWR_KEYS.styleGuides.detail(updatedStyleGuide.id));
      await mutate(SWR_KEYS.styleGuides.list());

      notifications.show({
        message: isNewAsset ? `Successfully created asset.` : `Successfully updated asset.`,
        color: 'green',
      });
      close({ asset: updatedStyleGuide, action: isNewAsset ? 'create' : 'update' });
    } catch (err) {
      setError('Failed to update asset');
      console.error('Error updating asset:', err);
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
      title={!isNewAsset ? `Edit ${form.values.name}` : isRemote ? 'Import asset from URL' : 'New asset'}
      size="xl"
      closeOnClickOutside={!isSaving}
      closeOnEscape={!isSaving}
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md" h="100%">
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

          {isNewAsset && <TextInput label="Name" disabled={isSaving} {...form.getInputProps('name')} />}

          {isRemote && (
            <TextInput
              label="URL"
              disabled={isSaving}
              flex={1}
              {...form.getInputProps('sourceUrl')}
              rightSection={
                <IconButtonOutline size="sm" onClick={handleDownloadAsset} loading={isSaving}>
                  <DownloadIcon size={14} />
                </IconButtonOutline>
              }
            />
          )}

          <Textarea
            ref={textareaRef}
            label="Content"
            minRows={20}
            maxRows={20}
            autosize
            disabled={isSaving || isRemote}
            styles={isRemote ? { input: { color: 'var(--fg-primary)' } } : undefined}
            {...form.getInputProps('content')}
          />

          <Checkbox
            label="Automatically include in all chats"
            disabled={isSaving}
            {...form.getInputProps('autoInclude', { type: 'checkbox' })}
          />

          <Group justify="flex-end" gap="sm">
            <ButtonSecondaryOutline onClick={handleClose} disabled={isSaving}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight loading={isSaving} disabled={!form.isValid()} type="submit" formAction="submit">
              {isNewAsset ? 'Add asset' : 'Save'}
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export const useEditAssetModal = () => {
  const [opened, setOpened] = useState(false);
  const [initialValues, setInitialValues] = useState<InitialValues | null>(null);

  const open = (asset: StyleGuide | 'new-text' | 'new-url') => {
    setInitialValues({ asset });
    setOpened(true);
  };

  const close = () => {
    setOpened(false);
  };

  return {
    opened,
    open,
    close,
    initialValues,
  };
};
