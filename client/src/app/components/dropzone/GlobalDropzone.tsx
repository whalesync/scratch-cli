'use client';
import { CsvPreviewResponse, MdPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import { useState } from 'react';
import { CsvPreviewModal } from '../modals/CsvPreviewModal';
import { MdPreviewModal } from '../modals/MdPreviewModal';
import { useDrag } from './useDrag';

export const GlobalDropzone = () => {
  const { isDragging, setIsDragging } = useDrag();

  // CSV preview state
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [csvPreviewFileName, setCsvPreviewFileName] = useState<string>('');
  const [csvPreviewFile, setCsvPreviewFile] = useState<File | null>(null);
  const [csvModalOpened, setCsvModalOpened] = useState(false);

  // MD preview state
  const [mdPreviewData, setMdPreviewData] = useState<MdPreviewResponse | null>(null);
  const [mdPreviewFileName, setMdPreviewFileName] = useState<string>('');
  const [mdPreviewFile, setMdPreviewFile] = useState<File | null>(null);
  const [mdModalOpened, setMdModalOpened] = useState(false);

  const handleDrop: DropzoneProps['onDrop'] = async (files) => {
    const file = files[0];
    if (!file) {
      setIsDragging(false);
      return;
    }

    const fileName = file.name.toLowerCase();

    // Handle CSV files
    if (fileName.endsWith('.csv')) {
      console.debug('CSV file dropped:', file.name);

      try {
        const preview = await uploadsApi.previewCsv(file);
        console.debug('CSV preview:', preview);

        setCsvPreviewData(preview);
        setCsvPreviewFileName(file.name);
        setCsvPreviewFile(file);
        setCsvModalOpened(true);
      } catch (error) {
        console.error('Failed to preview CSV:', error);
      }
    }
    // Handle MD files
    else if (fileName.endsWith('.md')) {
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

    setIsDragging(false);
  };

  const handleReject: DropzoneProps['onReject'] = (files) => {
    console.debug('File rejected:', files);
    setIsDragging(false);
  };

  return (
    <>
      {isDragging && (
        <Dropzone
          onDrop={handleDrop}
          onReject={handleReject}
          accept={{
            'text/csv': ['.csv'],
            'application/vnd.ms-excel': ['.csv'],
            'text/markdown': ['.md'],
            'text/plain': ['.md'],
          }}
          multiple={false}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            pointerEvents: 'auto',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(2px)',
          }}
          styles={{
            root: {
              border: '2px dashed #228be6',
              backgroundColor: 'transparent',
            },
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#228be6',
              fontSize: '18px',
              fontWeight: 500,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '2px dashed #228be6',
              borderRadius: '12px',
              margin: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div>Drop your CSV / MD / MD with FM file here</div>
            <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Release to preview</div>
          </div>
        </Dropzone>
      )}

      <CsvPreviewModal
        opened={csvModalOpened}
        onClose={() => {
          setCsvModalOpened(false);
          setCsvPreviewData(null);
          setCsvPreviewFile(null);
        }}
        data={csvPreviewData}
        fileName={csvPreviewFileName}
        file={csvPreviewFile}
      />

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
    </>
  );
};
