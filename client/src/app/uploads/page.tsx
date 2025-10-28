'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline, ContentFooterButton } from '@/app/components/base/buttons';
import { TextMdHeavier, TextSmBook, TextSmRegular } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ErrorInfo } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { useUploads } from '@/hooks/use-uploads';
import { CsvPreviewResponse, MdPreviewResponse, Upload, uploadsApi } from '@/lib/api/uploads';
import { formatDate, timeAgo } from '@/utils/helpers';
import { ActionIcon, Center, Group, Loader, Modal, Stack, Table, Text, Tooltip, useModalsStack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Download, Eye, FileText, Plus, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { BadgeBase } from '../components/base/badges';
import { CsvPreviewModal } from '../components/modals/CsvPreviewModal';
import { CsvViewModal } from '../components/modals/CsvViewModal';
import { MdPreviewModal } from '../components/modals/MdPreviewModal';
import { MdViewModal } from '../components/modals/MdViewModal';
import { SelectTitleColumnModal } from '../components/modals/SelectTitleColumnModal';

export default function UploadsPage() {
  const { uploads, isLoading, error, mutate } = useUploads();
  const [selectedUpload, setSelectedUpload] = useState<Upload | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingWorkbook, setIsCreatingWorkbook] = useState(false);
  const [downloadingUploadId, setDownloadingUploadId] = useState<string | null>(null);
  const modalStack = useModalsStack(['confirm-delete', 'select-title-column']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Title column selection state
  const [uploadForTitleSelection, setUploadForTitleSelection] = useState<Upload | null>(null);

  // CSV preview state
  const [csvPreviewData, setCsvPreviewData] = useState<CsvPreviewResponse | null>(null);
  const [csvPreviewFile, setCsvPreviewFile] = useState<File | null>(null);
  const [csvPreviewFileName, setCsvPreviewFileName] = useState<string>('');
  const [showCsvPreview, setShowCsvPreview] = useState(false);

  // MD preview state
  const [mdPreviewData, setMdPreviewData] = useState<MdPreviewResponse | null>(null);
  const [mdPreviewFile, setMdPreviewFile] = useState<File | null>(null);
  const [mdPreviewFileName, setMdPreviewFileName] = useState<string>('');
  const [showMdPreview, setShowMdPreview] = useState(false);

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
      router.push(`/snapshots/${result.snapshotId}`);
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CSV':
        return 'blue';
      case 'MD':
        return 'green';
      default:
        return 'gray';
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    // Handle CSV files
    if (fileName.endsWith('.csv')) {
      try {
        const preview = await uploadsApi.previewCsv(file);
        setCsvPreviewData(preview);
        setCsvPreviewFileName(file.name);
        setCsvPreviewFile(file);
        setShowCsvPreview(true);
      } catch (err) {
        console.error('Failed to preview CSV:', err);
        notifications.show({
          title: 'Error',
          message: 'Failed to preview CSV file',
          color: 'red',
        });
      }
    }
    // Handle Markdown files
    else if (fileName.endsWith('.md')) {
      try {
        const preview = await uploadsApi.previewMarkdown(file);
        setMdPreviewData(preview);
        setMdPreviewFileName(file.name);
        setMdPreviewFile(file);
        setShowMdPreview(true);
      } catch (err) {
        console.error('Failed to preview Markdown:', err);
        notifications.show({
          title: 'Error',
          message: 'Failed to preview Markdown file',
          color: 'red',
        });
      }
    } else {
      notifications.show({
        title: 'Invalid file',
        message: 'Please select a CSV or Markdown (.md) file',
        color: 'orange',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <MainContent>
          <MainContent.BasicHeader title="Uploads 1" />
          <MainContent.Body>
            <Center h="100%">
              <Loader />
              <TextSmRegular>Loading uploads...</TextSmRegular>
            </Center>
          </MainContent.Body>
        </MainContent>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout>
        <MainContent>
          <MainContent.BasicHeader title="Uploads" />
          <MainContent.Body>
            <ErrorInfo error={error} />
          </MainContent.Body>
        </MainContent>
      </PageLayout>
    );
  }

  const sortedUploads = uploads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <PageLayout>
      <MainContent>
        <MainContent.BasicHeader title="Uploads" />
        <MainContent.Body>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.md"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <CsvPreviewModal
            opened={showCsvPreview}
            onClose={() => {
              setShowCsvPreview(false);
              setCsvPreviewFile(null);
              setCsvPreviewData(null);
            }}
            data={csvPreviewData}
            fileName={csvPreviewFileName}
            file={csvPreviewFile}
          />

          <MdPreviewModal
            opened={showMdPreview}
            onClose={() => {
              setShowMdPreview(false);
              setMdPreviewFile(null);
              setMdPreviewData(null);
            }}
            data={mdPreviewData}
            fileName={mdPreviewFileName}
            file={mdPreviewFile}
          />

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
                <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>
                  Cancel
                </ButtonSecondaryOutline>
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

          {sortedUploads.length === 0 ? (
            <Center h="400px">
              <Stack align="center" gap="md">
                <StyledLucideIcon Icon={FileText} size={48} />
                <div style={{ textAlign: 'center' }}>
                  <TextMdHeavier>No uploads yet</TextMdHeavier>
                  <TextSmBook variant="dimmed" mt="xs">
                    Drag and drop a CSV or Markdown file anywhere to get started
                  </TextSmBook>
                </div>
              </Stack>
            </Center>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Td w="80px">Type</Table.Td>
                  <Table.Td>Name</Table.Td>
                  <Table.Td w="140px">Created</Table.Td>
                  <Table.Td w="140px">Updated</Table.Td>
                  <Table.Td w="170px" align="right">
                    Actions
                  </Table.Td>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedUploads.map((upload) => (
                  <Table.Tr key={upload.id}>
                    <Table.Td>
                      <BadgeBase color={getTypeColor(upload.type)}>{upload.type}</BadgeBase>
                    </Table.Td>
                    <Table.Td>
                      <TextMdHeavier>{upload.name}</TextMdHeavier>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={formatDate(upload.createdAt)}>
                        <TextSmRegular variant="dimmed">{timeAgo(upload.createdAt)}</TextSmRegular>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={formatDate(upload.updatedAt)}>
                        <TextSmRegular variant="dimmed">{timeAgo(upload.updatedAt)}</TextSmRegular>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td align="right">
                      <Group gap="xs" justify="flex-end">
                        <Tooltip label="View data">
                          <ActionIcon variant="subtle" color="gray" onClick={() => handleView(upload)}>
                            <StyledLucideIcon Icon={Eye} size={16} />
                          </ActionIcon>
                        </Tooltip>
                        {upload.type === 'CSV' && (
                          <>
                            <Tooltip label="Download CSV">
                              <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={() => handleDownload(upload)}
                                loading={downloadingUploadId === upload.id}
                              >
                                <StyledLucideIcon Icon={Download} size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Create workbook">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                onClick={() => handleCreateWorkbook(upload)}
                                loading={isCreatingWorkbook}
                              >
                                <StyledLucideIcon Icon={Plus} size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip label="Delete upload">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => {
                              setSelectedUpload(upload);
                              modalStack.open('confirm-delete');
                            }}
                          >
                            <StyledLucideIcon Icon={Trash2} size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </MainContent.Body>
        <MainContent.Footer>
          <ContentFooterButton leftSection={<UploadIcon size={16} />} onClick={() => fileInputRef.current?.click()}>
            Upload file
          </ContentFooterButton>
        </MainContent.Footer>
      </MainContent>
    </PageLayout>
  );
}
