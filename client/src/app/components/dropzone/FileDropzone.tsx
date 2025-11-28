'use client';

import { Center, Stack } from '@mantine/core';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import { Upload, X } from 'lucide-react';
import { Text13Regular, Text16Medium } from '../base/text';
import { DecorativeBoxedIcon } from '../Icons/DecorativeBoxedIcon';
import customBorderStyles from '../theme/custom-borders.module.css';
import styles from './FileDropzone.module.css';

export interface FileDropzoneProps extends DropzoneProps {
  children: React.ReactNode;
  fileTypeDescription: string;
  acceptContent?: React.ReactNode;
  rejectContent?: React.ReactNode;
}

export const FileDropzone = ({
  children,
  fileTypeDescription,
  onDrop,
  onReject,
  accept,
  openRef,
  acceptContent,
  rejectContent,
  ...props
}: FileDropzoneProps) => {
  return (
    <Dropzone
      enablePointerEvents
      activateOnClick={false}
      openRef={openRef}
      onDrop={onDrop}
      onReject={onReject}
      accept={accept}
      multiple={false}
      classNames={{ root: styles.dropzoneRoot }}
      {...props}
    >
      {children}
      <Dropzone.Accept>
        <Center className={styles.dropzoneFeedbackOuter}>
          <Stack className={`${customBorderStyles.cornerBorders} ${styles.dropzoneFeedbackInner}`}>
            {acceptContent || (
              <>
                <DecorativeBoxedIcon Icon={Upload} />
                <Text16Medium>Drop {fileTypeDescription} file here to upload</Text16Medium>
              </>
            )}
          </Stack>
        </Center>
      </Dropzone.Accept>

      <Dropzone.Reject>
        <Center className={styles.dropzoneFeedbackOuter}>
          <Stack className={`${customBorderStyles.cornerBorders} ${styles.dropzoneFeedbackInner}`}>
            {rejectContent || (
              <>
                <DecorativeBoxedIcon Icon={X} c="var(--mantine-color-red-8)" bg="var(--mantine-color-red-2)" />
                <Text16Medium>Unsupported file</Text16Medium>
                <Text13Regular c="dimmed">Only {fileTypeDescription} files can be uploaded</Text13Regular>
              </>
            )}
          </Stack>
        </Center>
      </Dropzone.Reject>
    </Dropzone>
  );
};
