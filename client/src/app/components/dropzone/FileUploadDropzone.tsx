'use client';
import { CsvPreviewResponse, MdPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { Center, MantineStyleProps, Stack } from '@mantine/core';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import { Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Text13Regular, Text16Medium } from '../base/text';
import { DecorativeBoxedIcon } from '../Icons/DecorativeBoxedIcon';
import { CsvPreviewModal } from '../modals/CsvPreviewModal';
import { MdPreviewModal } from '../modals/MdPreviewModal';
import { ScratchpadNotifications } from '../ScratchpadNotifications';
import customBorderStyles from '../theme/custom-borders.module.css';
import styles from './FileUploadDropzone.module.css';

export const FileUploadDropzone = ({
  children,
  allowedTypes,
  openRef,
  disableNavigation = false,
  onUploadComplete,
  ...props
}: {
  allowedTypes: ('csv' | 'md')[];
  openRef?: React.ForwardedRef<() => void | undefined>;
  children: React.ReactNode;
  disableNavigation?: boolean;
  onUploadComplete?: () => void;
} & MantineStyleProps) => {
  // CSV preview state
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [csvPreviewFileName, setCsvPreviewFileName] = useState<string>('');
  const [csvPreviewFile, setCsvPreviewFile] = useState<File | null>(null);
  const [csvModalOpened, setCsvModalOpened] = useState(false);
  const [csvPreviewError, setCsvPreviewError] = useState<string | null>(null);

  // MD preview state
  const [mdPreviewData, setMdPreviewData] = useState<MdPreviewResponse | null>(null);
  const [mdPreviewFileName, setMdPreviewFileName] = useState<string>('');
  const [mdPreviewFile, setMdPreviewFile] = useState<File | null>(null);
  const [mdModalOpened, setMdModalOpened] = useState(false);

  const accept = useMemo(() => {
    const accept: DropzoneProps['accept'] = {};
    if (allowedTypes.includes('csv')) {
      accept['text/csv'] = ['.csv'];
      accept['application/vnd.ms-excel'] = ['.csv'];
    }
    if (allowedTypes.includes('md')) {
      accept['text/markdown'] = ['.md'];
      accept['text/plain'] = ['.md'];
    }
    return accept;
  }, [allowedTypes]);

  const handleDrop: DropzoneProps['onDrop'] = async (files) => {
    const file = files[0];
    if (!file) {
      // setIsDragging(false);
      return;
    }

    const fileName = file.name.toLowerCase();

    // Handle CSV files
    if (allowedTypes.includes('csv') && fileName.endsWith('.csv')) {
      console.debug('CSV file dropped:', file.name);

      try {
        const preview = await uploadsApi.previewCsv(file);
        console.debug('CSV preview:', preview);

        setCsvPreviewData(preview);
        setCsvPreviewFileName(file.name);
        setCsvPreviewFile(file);
        setCsvPreviewError(null);
        setCsvModalOpened(true);
      } catch (error) {
        console.error('Failed to preview CSV:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse CSV file';
        setCsvPreviewError(errorMessage);
        ScratchpadNotifications.error({
          title: 'CSV Preview Failed',
          message: errorMessage,
        });
      }
    }
    // Handle MD files
    else if (allowedTypes.includes('md') && fileName.endsWith('.md')) {
      console.debug('MD file dropped:', file.name);

      try {
        const preview = await uploadsApi.previewMarkdown(file);
        console.debug('MD preview:', preview);

        setMdPreviewData(preview);
        setMdPreviewFileName(file.name);
        setMdPreviewFile(file);
        setMdModalOpened(true);
      } catch (error) {
        console.error('Failed to preview MD:', error);
      }
    }
  };

  const handleReject: DropzoneProps['onReject'] = () => {
    ScratchpadNotifications.error({
      title: 'Upload failed',
      message: `File type not allowed. Please upload a ${allowedTypes.join(' or ')} file.`,
    });
  };

  return (
    <div>
      {allowedTypes.includes('csv') && csvModalOpened && (
        <CsvPreviewModal
          opened={true} // Unmount instead of hiding to reset state
          onClose={() => {
            setCsvModalOpened(false);
            setCsvPreviewData(null);
            setCsvPreviewFile(null);
            setCsvPreviewError(null);
            // Call the upload complete callback when CSV preview closes
            onUploadComplete?.();
          }}
          data={csvPreviewData}
          fileName={csvPreviewFileName}
          file={csvPreviewFile}
          previewError={csvPreviewError}
          disableNavigation={disableNavigation}
        />
      )}

      {allowedTypes.includes('md') && (
        <MdPreviewModal
          opened={mdModalOpened}
          onClose={() => {
            setMdModalOpened(false);
            setMdPreviewData(null);
            setMdPreviewFile(null);
          }}
          data={mdPreviewData}
          fileName={mdPreviewFileName}
          file={mdPreviewFile}
        />
      )}

      <Dropzone
        enablePointerEvents
        activateOnClick={false}
        openRef={openRef}
        onDrop={handleDrop}
        onReject={handleReject}
        accept={accept}
        multiple={false}
        classNames={{ root: styles.dropzoneRoot }}
        {...props}
      >
        {children}
        <Dropzone.Accept>
          <Center className={styles.dropzoneFeedbackOuter}>
            <Stack className={`${customBorderStyles.cornerBorders} ${styles.dropzoneFeedbackInner}`}>
              <DecorativeBoxedIcon Icon={Upload} />
              <Text16Medium>Drop {allowedTypes.join(' or ')} file here to upload</Text16Medium>
            </Stack>
          </Center>
        </Dropzone.Accept>

        <Dropzone.Reject>
          <Center className={styles.dropzoneFeedbackOuter}>
            <Stack className={`${customBorderStyles.cornerBorders} ${styles.dropzoneFeedbackInner}`}>
              <DecorativeBoxedIcon Icon={X} c="var(--mantine-color-red-8)" bg="var(--mantine-color-red-2)" />
              <Text16Medium>Unsupported file</Text16Medium>
              <Text13Regular c="dimmed">Only {allowedTypes.join(' or ')} files can be uploaded</Text13Regular>
            </Stack>
          </Center>
        </Dropzone.Reject>
      </Dropzone>
    </div>
  );
};
