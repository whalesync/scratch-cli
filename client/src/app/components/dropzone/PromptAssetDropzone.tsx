'use client';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SWR_KEYS } from '@/lib/api/keys';
import { styleGuideApi } from '@/lib/api/style-guide';
import { CreateStyleGuideDto, DEFAULT_CONTENT_TYPE } from '@/types/server-entities/style-guide';
import { MantineStyleProps } from '@mantine/core';
import { DropzoneProps } from '@mantine/dropzone';
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

      const newData: CreateStyleGuideDto = {
        name: file.name,
        body: text,
        autoInclude: false,
        sourceUrl: undefined,
        contentType: DEFAULT_CONTENT_TYPE,
        tags: [],
      };

      await styleGuideApi.create(newData);

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
