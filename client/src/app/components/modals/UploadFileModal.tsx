'use client';

import { Center, Modal, Stack } from '@mantine/core';
import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { Text13Medium } from '../base/text';
import { FileUploadDropzone } from '../dropzone/FileUploadDropzone';
import { DecorativeBoxedIcon } from '../Icons/DecorativeBoxedIcon';

interface UploadFileModalProps {
  opened: boolean;
  onClose: () => void;
}

export const UploadFileModal = ({ opened, onClose }: UploadFileModalProps) => {
  const openFileInputRef = useRef<() => void>(null);

  return (
    <Modal opened={opened} onClose={onClose} centered withCloseButton={false} size={240}>
      <FileUploadDropzone
        allowedTypes={['csv']}
        openRef={openFileInputRef}
        disableNavigation={true}
        onUploadComplete={onClose}
      >
        <Center style={{ cursor: 'pointer' }} onClick={() => openFileInputRef.current?.()}>
          <Stack align="center" gap="md">
            <DecorativeBoxedIcon Icon={Upload} />
            <Text13Medium>Drop CSV file here to upload</Text13Medium>
          </Stack>
        </Center>
      </FileUploadDropzone>
    </Modal>
  );
};
