'use client';

import { filesApi, foldersApi } from '@/lib/api/files';
import { Alert, Loader, Modal, Progress, Stack, Text } from '@mantine/core';
import { AlertCircleIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  generateMarkdown,
  generatePreviews,
  generateUniqueFilename,
  parseCSV,
  slugify,
  type MarkdownPreview,
  type ParsedCsv,
} from './csv-utils';
import {
  OrderContentStep,
  PreviewStep,
  SelectColumnsStep,
  SelectContentStep,
  SelectNameColumnStep,
} from './steps';
import type { CsvConversionConfig, CsvToMdModalProps, ModalStep } from './types';

export function CsvToMdModal({
  opened,
  onClose,
  workbookId,
  fileId,
  fileName,
  parentFolderId,
  onSuccess,
}: CsvToMdModalProps) {
  // Modal state
  const [step, setStep] = useState<ModalStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv | null>(null);
  const [previews, setPreviews] = useState<MarkdownPreview[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Configuration state
  const [config, setConfig] = useState<CsvConversionConfig>({
    includedColumns: [],
    nameColumn: '',
    contentColumns: [],
  });

  // Derive folder name from CSV filename
  const folderName = fileName.replace(/\.csv$/i, '');

  // Load CSV content when modal opens
  useEffect(() => {
    if (!opened) {
      // Reset state when modal closes
      setStep('loading');
      setError(null);
      setParsedCsv(null);
      setPreviews([]);
      setProgress(null);
      setConfig({
        includedColumns: [],
        nameColumn: '',
        contentColumns: [],
      });
      return;
    }

    const loadCsv = async () => {
      try {
        setStep('loading');
        setError(null);

        const response = await filesApi.getFile(workbookId, fileId);
        const content = response.file.content || '';

        const parsed = parseCSV(content);
        setParsedCsv(parsed);

        // Initialize config with all columns selected
        setConfig({
          includedColumns: parsed.headers,
          nameColumn: '',
          contentColumns: [],
        });

        setStep('select-columns');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load CSV file');
        setStep('error');
      }
    };

    loadCsv();
  }, [opened, workbookId, fileId]);

  // Update previews when config changes and we're on preview step
  useEffect(() => {
    if (step === 'preview' && parsedCsv && config.nameColumn) {
      const newPreviews = generatePreviews(parsedCsv, config, 3);
      setPreviews(newPreviews);
    }
  }, [step, parsedCsv, config]);

  // Step navigation
  const goToSelectColumns = useCallback(() => setStep('select-columns'), []);
  const goToSelectName = useCallback(() => setStep('select-name'), []);
  const goToSelectContent = useCallback(() => setStep('select-content'), []);

  const goToOrderContentOrPreview = useCallback(() => {
    if (config.contentColumns.length > 1) {
      setStep('order-content');
    } else {
      setStep('preview');
    }
  }, [config.contentColumns.length]);

  const goToPreview = useCallback(() => setStep('preview'), []);

  // Handle file creation
  const handleCreate = useCallback(async () => {
    if (!parsedCsv) return;

    setStep('creating');
    setProgress({ current: 0, total: parsedCsv.rows.length });

    try {
      // Create folder
      const folderResponse = await foldersApi.createFolder(workbookId, {
        name: folderName,
        parentFolderId: parentFolderId,
      });
      const folderId = folderResponse.folder.id;

      // Determine metadata columns
      const metadataColumns = config.includedColumns.filter(
        (col) => col !== config.nameColumn && !config.contentColumns.includes(col)
      );

      // Track used filenames
      const usedFilenames = new Set<string>();

      // Create files one by one
      for (let i = 0; i < parsedCsv.rows.length; i++) {
        const row = parsedCsv.rows[i];

        // Build row map
        const rowMap: Record<string, string> = {};
        for (let j = 0; j < parsedCsv.headers.length; j++) {
          rowMap[parsedCsv.headers[j]] = row[j] || '';
        }

        // Determine filename
        const nameValue = rowMap[config.nameColumn];
        let baseFilename: string;
        if (nameValue && nameValue.trim() !== '') {
          baseFilename = slugify(nameValue);
        } else {
          baseFilename = `row-${i + 1}`;
        }

        const filename = generateUniqueFilename(baseFilename, usedFilenames) + '.md';

        // Generate markdown content
        const content = generateMarkdown(rowMap, config.contentColumns, metadataColumns);

        // Create file
        await filesApi.createFile(workbookId, {
          name: filename,
          content,
          parentFolderId: folderId,
        });

        setProgress({ current: i + 1, total: parsedCsv.rows.length });
      }

      // Success - close and refresh
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create files');
      setStep('error');
    }
  }, [
    parsedCsv,
    workbookId,
    folderName,
    parentFolderId,
    config,
    onSuccess,
  ]);

  // Get modal title based on step
  const getTitle = () => {
    switch (step) {
      case 'loading':
        return 'Loading CSV...';
      case 'error':
        return 'Error';
      case 'select-columns':
        return 'Select Columns';
      case 'select-name':
        return 'Select Filename Column';
      case 'select-content':
        return 'Select Content Columns';
      case 'order-content':
        return 'Order Content Columns';
      case 'preview':
        return 'Preview';
      case 'creating':
        return 'Creating Files...';
      default:
        return 'Convert CSV to Markdown';
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={getTitle()} size="lg">
      {step === 'loading' && (
        <Stack align="center" py="xl">
          <Loader size="md" />
          <Text size="sm" c="var(--fg-secondary)">
            Loading and parsing CSV file...
          </Text>
        </Stack>
      )}

      {step === 'error' && (
        <Stack gap="md">
          <Alert icon={<AlertCircleIcon size={16} />} color="red" title="Error">
            {error}
          </Alert>
        </Stack>
      )}

      {step === 'select-columns' && parsedCsv && (
        <SelectColumnsStep
          columns={parsedCsv.columns}
          selectedColumns={config.includedColumns}
          onSelectionChange={(cols) => setConfig((c) => ({ ...c, includedColumns: cols }))}
          onNext={goToSelectName}
          onBack={onClose}
        />
      )}

      {step === 'select-name' && parsedCsv && (
        <SelectNameColumnStep
          columns={parsedCsv.columns}
          includedColumns={config.includedColumns}
          selectedColumn={config.nameColumn}
          onSelectionChange={(col) => setConfig((c) => ({ ...c, nameColumn: col }))}
          onNext={goToSelectContent}
          onBack={goToSelectColumns}
        />
      )}

      {step === 'select-content' && parsedCsv && (
        <SelectContentStep
          columns={parsedCsv.columns}
          includedColumns={config.includedColumns}
          nameColumn={config.nameColumn}
          selectedColumns={config.contentColumns}
          onSelectionChange={(cols) => setConfig((c) => ({ ...c, contentColumns: cols }))}
          onNext={goToOrderContentOrPreview}
          onBack={goToSelectName}
        />
      )}

      {step === 'order-content' && (
        <OrderContentStep
          contentColumns={config.contentColumns}
          onOrderChange={(cols) => setConfig((c) => ({ ...c, contentColumns: cols }))}
          onNext={goToPreview}
          onBack={goToSelectContent}
        />
      )}

      {step === 'preview' && parsedCsv && (
        <PreviewStep
          previews={previews}
          totalRows={parsedCsv.rows.length}
          folderName={folderName}
          onNext={handleCreate}
          onBack={config.contentColumns.length > 1 ? () => setStep('order-content') : goToSelectContent}
        />
      )}

      {step === 'creating' && progress && (
        <Stack gap="md" py="md">
          <Text size="sm" ta="center">
            Creating file {progress.current} of {progress.total}...
          </Text>
          <Progress value={(progress.current / progress.total) * 100} size="lg" animated />
          <Text size="xs" c="var(--fg-muted)" ta="center">
            Please wait while the files are being created.
          </Text>
        </Stack>
      )}
    </Modal>
  );
}
