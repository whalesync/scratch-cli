'use client';

import { Center, Modal, Stack } from '@mantine/core';
import { Upload } from 'lucide-react';
import { useRef } from 'react';
import { Text13Medium } from '../base/text';
import { UploadsTableDropZone } from '../dropzone/UploadsTableDropZone';
import { DecorativeBoxedIcon } from '../Icons/DecorativeBoxedIcon';

interface UploadFileModalProps {
  opened: boolean;
  onClose: () => void;
}

export const UploadFileModal = ({ opened, onClose }: UploadFileModalProps) => {
  const openFileInputRef = useRef<() => void>(null);

  const dropContent = (
    <>
      <DecorativeBoxedIcon Icon={Upload} />
      <Text13Medium>Drop CSV file here to upload</Text13Medium>
    </>
  );

  return (
    <Modal opened={opened} onClose={onClose} centered withCloseButton={false}>
      <UploadsTableDropZone
        allowedTypes={['csv']}
        openRef={openFileInputRef}
        disableNavigation={true}
        onUploadComplete={onClose}
        acceptContent={dropContent}
      >
        <Center style={{ cursor: 'pointer' }} onClick={() => openFileInputRef.current?.()} p={100}>
          <Stack align="center" gap="md">
            {dropContent}
          </Stack>
        </Center>
      </UploadsTableDropZone>
    </Modal>
  );
};
