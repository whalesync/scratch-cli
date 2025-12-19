'use client';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SWR_KEYS } from '@/lib/api/keys';
import { promptAssetApi } from '@/lib/api/prompt-asset';
import { MantineStyleProps } from '@mantine/core';
import { DropzoneProps } from '@mantine/dropzone';
import { CreateStyleGuideDto, DEFAULT_CONTENT_TYPE } from '@spinner/shared-types';
import { mutate } from 'swr';
import { FileDropzone } from './FileDropzone';

export const PromptAssetDropzone = ({
  children,
  openRef,
  ...props
}: {
  openRef?: React.ForwardedRef<() => void | undefined>;
  children: React.ReactNode;
} & MantineStyleProps) => {
  const handleDrop: DropzoneProps['onDrop'] = async (files) => {
    const file = files[0];
    if (!file) return;

    try {
      // Read file content
      const text = await file.text();

      const newData = new CreateStyleGuideDto();
      newData.name = file.name;
      newData.body = text;
      newData.autoInclude = false;
      newData.sourceUrl = undefined;
      newData.contentType = DEFAULT_CONTENT_TYPE;
      newData.tags = [];

      await promptAssetApi.create(newData);

      // Invalidate queries to refresh the list
      await mutate(SWR_KEYS.styleGuides.list());

      ScratchpadNotifications.success({
        title: 'Asset uploaded',
        message: `Successfully uploaded ${file.name}`,
      });
    } catch (error) {
      console.error('Failed to upload asset:', error);
      ScratchpadNotifications.error({
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload file',
      });
    }
  };

  const handleReject: DropzoneProps['onReject'] = () => {
    ScratchpadNotifications.error({
      title: 'Upload failed',
      message: 'File type not allowed. Please upload a text file.',
    });
  };

  return (
    <FileDropzone
      openRef={openRef}
      onDrop={handleDrop}
      onReject={handleReject}
      accept={{
        'text/plain': ['.txt', '.md'],
        'text/markdown': ['.md'],
        'application/json': ['.json'],
      }}
      fileTypeDescription="text"
      {...props}
    >
      {children}
    </FileDropzone>
  );
};
