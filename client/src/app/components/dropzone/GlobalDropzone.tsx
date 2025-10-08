'use client';
import { CsvPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import { useState } from 'react';
import { CsvPreviewModal } from '../modals/CsvPreviewModal';
import { useDrag } from './useDrag';

export const GlobalDropzone = () => {
  const { isDragging, setIsDragging } = useDrag();
  const [previewData, setPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  const handleDrop: DropzoneProps['onDrop'] = async (files) => {
    const csvFile = files.find((file) => file.name.toLowerCase().endsWith('.csv'));
    if (csvFile) {
      console.debug('CSV file dropped:', csvFile.name);

      try {
        const preview = await uploadsApi.previewCsv(csvFile);
        console.debug('CSV preview:', preview);

        setPreviewData(preview);
        setPreviewFileName(csvFile.name);
        setPreviewFile(csvFile);
        setModalOpened(true);
      } catch (error) {
        console.error('Failed to preview CSV:', error);
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
            <div>Drop your CSV file here</div>
            <div style={{ fontSize: '14px', marginTop: '8px', opacity: 0.7 }}>Release to upload</div>
          </div>
        </Dropzone>
      )}

      <CsvPreviewModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        data={previewData}
        fileName={previewFileName}
        file={previewFile}
      />
    </>
  );
};
