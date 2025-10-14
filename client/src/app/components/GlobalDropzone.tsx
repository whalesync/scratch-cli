'use client';
import { Dropzone, DropzoneProps } from '@mantine/dropzone';
import { useEffect, useRef, useState } from 'react';

export const GlobalDropzone = () => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current += 1;

      if (dragCounterRef.current === 1 && e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        // Clear any existing timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      dragCounterRef.current -= 1;

      if (dragCounterRef.current === 0) {
        // Add a small delay to prevent flashing when moving between elements
        timeoutRef.current = setTimeout(() => {
          setIsDragging(false);
        }, 50);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsDragging(false);
      dragCounterRef.current = 0;
    };

    // Add event listeners to the document
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleDrop: DropzoneProps['onDrop'] = (files) => {
    const csvFile = files.find((file) => file.name.toLowerCase().endsWith('.csv'));

    if (csvFile) {
      console.debug('CSV file dropped:', csvFile.name);

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        console.debug('CSV content:', content);
      };
      reader.readAsText(csvFile);
    }

    setIsDragging(false);
    // setDragCounter(0);
  };

  const handleReject: DropzoneProps['onReject'] = (files) => {
    console.debug('File rejected:', files);
    setIsDragging(false);
    // setDragCounter(0);
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
    </>
  );
};
