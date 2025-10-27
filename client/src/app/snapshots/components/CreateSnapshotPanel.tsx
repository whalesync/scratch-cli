'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline, ContentFooterButton } from '@/app/components/base/buttons';
import { CsvPreviewModal } from '@/app/components/modals/CsvPreviewModal';
import { snapshotApi } from '@/lib/api/snapshot';
import { CsvPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { Alert, Group, Modal, Stack, TextInput, useModalsStack } from '@mantine/core';
import { PlusIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';

export const CreateSnapshotPanel = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const modalStack = useModalsStack(['create-content-snapshot']);
  const [contentName, setContentName] = useState('');

  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [showCsvPreview, setShowCsvPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      ScratchpadNotifications.error({
        title: 'Invalid file type',
        message: 'Please select a CSV file.',
      });
      return;
    }

    setCsvFile(file);
    setIsLoadingPreview(true);

    try {
      const previewData = await uploadsApi.previewCsv(file);
      setCsvPreviewData(previewData);
      setShowCsvPreview(true);
    } catch (error) {
      console.error('Error previewing CSV:', error);
      ScratchpadNotifications.error({
        title: 'Error previewing CSV',
        message: error instanceof Error ? error.message : 'Failed to preview CSV file.',
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCreateContentSnapshot = async () => {
    if (!contentName) {
      setSaveError('Content name is required');
      return;
    }

    setIsSaving(true);
    try {
      const result = await uploadsApi.createTemplate({ scratchpaperName: contentName });

      ScratchpadNotifications.success({
        title: 'Template scratchpaper created',
        message: 'The template scratchpaper has been created',
      });

      await sleep(200);

      // Get the snapshot details to navigate to it
      const snapshot = await snapshotApi.detail(result.snapshotId);
      if (snapshot) {
        const tableId = snapshot.tables.length > 0 ? snapshot.tables[0].id.wsId : undefined;
        let recordId = undefined;
        if (tableId) {
          const records = await snapshotApi.listRecords(snapshot.id, tableId ?? '', undefined, 1);
          recordId = records.records.length > 0 ? records.records[0].id.wsId : undefined;
        }
        modalStack.close('create-content-snapshot');

        // deep link to the first record in the first table if possible
        router.push(RouteUrls.snapshotPage(snapshot.id, tableId, recordId));
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal title="Create scratchpaper" centered size="md" {...modalStack.register('create-content-snapshot')}>
        <Stack>
          {saveError && (
            <Alert color="red" title="Error creating content snapshot">
              {saveError}
            </Alert>
          )}
          <TextInput
            label="Content Name"
            description="Defines the name scratchpaper table"
            required
            value={contentName}
            onChange={(e) => setContentName(e.target.value)}
          />
          <Group justify="flex-end">
            <ButtonSecondaryOutline
              onClick={() => {
                setContentName('');
                setSaveError(null);
                modalStack.close('create-content-snapshot');
              }}
            >
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleCreateContentSnapshot} loading={isSaving} disabled={!contentName}>
              Create
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Group>
        <ContentFooterButton
          w="min-content"
          onClick={handleCsvFileSelect}
          leftSection={<PlusIcon size={16} />}
          loading={isLoadingPreview}
        >
          New scratchpaper from CSV file
        </ContentFooterButton>
        <ContentFooterButton
          w="min-content"
          onClick={() => modalStack.open('create-content-snapshot')}
          leftSection={<PlusIcon size={16} />}
          loading={isSaving}
        >
          New scratchpaper from template
        </ContentFooterButton>
      </Group>

      {/* Hidden file input for CSV selection */}
      <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* CSV Preview Modal */}
      <CsvPreviewModal
        opened={showCsvPreview}
        onClose={() => {
          setShowCsvPreview(false);
          setCsvFile(null);
          setCsvPreviewData(null);
          setIsLoadingPreview(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }}
        data={csvPreviewData}
        fileName={csvFile?.name ?? ''}
        file={csvFile}
      />
    </>
  );
};
