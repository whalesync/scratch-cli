'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ErrorInfo, Info } from '@/app/components/InfoPanel';
import { useUploads } from '@/hooks/use-uploads';
import { Upload, uploadsApi } from '@/lib/api/uploads';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Loader, Modal, Stack, Table, Text, useModalsStack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { TextMono13Regular } from '../../components/base/text';
import { FileUploadDropzone } from '../../components/dropzone/FileUploadDropzone';
import { CsvViewModal } from '../../components/modals/CsvViewModal';
import { MdViewModal } from '../../components/modals/MdViewModal';
import { SelectTitleColumnModal } from '../../components/modals/SelectTitleColumnModal';
import UploadsRow from './UploadsRow';

export default function UploadsTable() {
  const { uploads, isLoading, error, mutate } = useUploads();
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingWorkbook, setIsCreatingWorkbook] = useState(false);
  const [downloadingUploadId, setDownloadingUploadId] = useState<string | null>(null);
  const modalStack = useModalsStack(['confirm-delete', 'select-title-column']);
  const openFileInputRef = useRef<() => void>(null);
  const router = useRouter();

  // Title column selection state
  const [uploadForTitleSelection, setUploadForTitleSelection] = useState<Upload | null>(null);

  // View state (for existing uploads)
  const [viewUpload, setViewUpload] = useState<Upload | null>(null);
  const [showCsvView, setShowCsvView] = useState(false);
  const [showMdView, setShowMdView] = useState(false);

  const handleDelete = async () => {
    if (!selectedUpload) return;

    setIsDeleting(true);
    try {
      await uploadsApi.deleteUpload(selectedUpload.id);
      notifications.show({
        title: 'Success',
        message: 'Upload deleted successfully',
        color: 'green',
      });
      await mutate();
      setSelectedUpload(null);
    } catch (err) {
      console.error('Failed to delete upload:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete upload',
        color: 'red',
      });
    } finally {
      setIsDeleting(false);
      modalStack.close('confirm-delete');
    }
  };

  const handleCreateWorkbook = async (upload: Upload) => {
    // Show the title column selection modal
    setUploadForTitleSelection(upload);
    modalStack.open('select-title-column');
  };

  const handleConfirmCreateWorkbook = async (titleColumnRemoteId: string[]) => {
    if (!uploadForTitleSelection) return;

    modalStack.close('select-title-column');
    setIsCreatingWorkbook(true);
    try {
      const result = await uploadsApi.createWorkbookFromCsv(
        uploadForTitleSelection.id,
        uploadForTitleSelection.name,
        titleColumnRemoteId,
      );
      notifications.show({
        title: 'Success',
        message: `Workbook "${uploadForTitleSelection.name}" created successfully`,
        color: 'green',
      });
      // Navigate to the new workbook
      router.push(RouteUrls.workbookPageUrl(result.workbookId));
    } catch (err) {
      console.error('Failed to create workbook:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to create workbook',
        color: 'red',
      });
    } finally {
      setIsCreatingWorkbook(false);
      setUploadForTitleSelection(null);
    }
  };

  const handleDownload = async (upload: Upload) => {
    setDownloadingUploadId(upload.id);
    try {
      await uploadsApi.downloadCsv(upload.id, upload.name);
      // No need for success notification - browser handles the download
    } catch (err) {
      console.error('Failed to download CSV:', err);
      notifications.show({
        title: 'Error',
        message: 'Failed to download CSV',
        color: 'red',
      });
    } finally {
      // Small delay to show the loading state before clearing
      setTimeout(() => setDownloadingUploadId(null), 500);
    }
  };

  const handleView = (upload: Upload) => {
    setViewUpload(upload);
    if (upload.type === 'CSV') {
      setShowCsvView(true);
    } else if (upload.type === 'MD') {
      setShowMdView(true);
    }
  };

  // TODO: Only request CSVs from the server instead of filtering here.
  const sortedCsvUploads = uploads
    .filter((upload) => upload.type === 'CSV')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let content = null;

  if (isLoading) {
    content = <Loader />;
  } else if (error) {
    content = <ErrorInfo error={error} />;
  } else {
    content = (
      <Table ml="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Td>Name</Table.Td>
            <Table.Td w="10%">Type</Table.Td>
            <Table.Td w="20%">Status</Table.Td>
            <Table.Td w="20%">Created</Table.Td>
            <Table.Td w="120px" align="right"></Table.Td>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedCsvUploads.map((upload) => (
            <UploadsRow
              key={upload.id}
              upload={upload}
              onView={handleView}
              onCreateWorkbook={handleCreateWorkbook}
              onDownload={handleDownload}
              isDownloading={downloadingUploadId === upload.id}
              isCreatingWorkbook={isCreatingWorkbook}
              onDelete={() => {
                setSelectedUpload(upload);
                modalStack.open('confirm-delete');
              }}
            />
          ))}
        </Table.Tbody>
      </Table>
    );
  }

  return (
    <>
      <CsvViewModal
        opened={showCsvView}
        onClose={() => {
          setShowCsvView(false);
          setViewUpload(null);
        }}
        uploadId={viewUpload?.id || null}
        uploadName={viewUpload?.name || null}
      />

      <MdViewModal
        opened={showMdView}
        onClose={() => {
          setShowMdView(false);
          setViewUpload(null);
        }}
        uploadId={viewUpload?.id || null}
        uploadName={viewUpload?.name || null}
      />

      <Modal {...modalStack.register('confirm-delete')} title="Delete Upload" centered size="lg">
        <Stack>
          <Text>Are you sure you want to delete this upload?</Text>
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleDelete} loading={isDeleting}>
              Delete
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>

      <SelectTitleColumnModal
        {...modalStack.register('select-title-column')}
        uploadId={uploadForTitleSelection?.id || ''}
        uploadName={uploadForTitleSelection?.name || ''}
        onConfirm={handleConfirmCreateWorkbook}
      />

      <FileUploadDropzone allowedTypes={['csv']} openRef={openFileInputRef} mt="xl">
        <Group justify="space-between" align="top">
          <TextMono13Regular c="dimmed">UPLOADED TABLES</TextMono13Regular>
          <ButtonSecondaryOutline leftSection={<UploadIcon />} onClick={() => openFileInputRef.current?.()}>
            Upload CSV file
          </ButtonSecondaryOutline>
        </Group>
        {content}
        {sortedCsvUploads.length === 0 && (
          <Info>
            <Info.FileIcon />
            <Info.Title>No uploads yet</Info.Title>
            <Info.Description>Drag and drop a CSV to get started</Info.Description>
          </Info>
        )}
      </FileUploadDropzone>
    </>
  );
}
