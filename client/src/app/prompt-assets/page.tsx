'use client';

import { usePromptAssets } from '@/hooks/use-prompt-assets';
import { styleGuideApi } from '@/lib/api/style-guide';
import { trackClickDownloadResource } from '@/lib/posthog';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { formatBytes } from '@/utils/helpers';
import { Alert, Badge, Group, Modal, Paper, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FileCodeIcon, FileMdIcon, FileTextIcon } from '@phosphor-icons/react';
import { DownloadIcon, LinkIcon, PencilLineIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { StyleGuideId } from '../../types/server-entities/ids';
import { ButtonPrimaryLight, ButtonSecondaryOutline, ContentFooterButton } from '../components/base/buttons';
import { Text13Medium, Text13Regular } from '../components/base/text';
import { FileUploadDropzone } from '../components/dropzone/FileUploadDropzone';
import { EditResourceModal } from '../components/EditResourceModal';
import MainContent from '../components/layouts/MainContent';
import { ScratchpadNotifications } from '../components/ScratchpadNotifications';
import { ToolIconButton } from '../components/ToolIconButton';

export default function PromptAssetsPage() {
  const { promptAssets, isLoading, error, mutate } = usePromptAssets();
  const [isCreateModalOpen, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [isDeleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [isExternalResourceUpdating, setIsExternalResourceUpdating] = useState(false);
  const [activeResource, setActiveResource] = useState<StyleGuide | null>(null);

  const handleEditResource = (resource: StyleGuide) => {
    setActiveResource(resource);
    openCreateModal();
  };

  const handleNewAsset = useCallback(async () => {
    setActiveResource(null);
    openCreateModal();
  }, [openCreateModal]);

  const handleDeleteAsset = async (id: StyleGuideId) => {
    try {
      await styleGuideApi.delete(id);
      setActiveResource(null);
      await mutate();
    } catch (error) {
      console.log('Error deleting resource:', error);
    }
  };

  const handleUpdateExternalResource = async (id: string) => {
    try {
      setIsExternalResourceUpdating(true);
      await styleGuideApi.updateExternalResource(id);
      trackClickDownloadResource();
      await mutate();
      ScratchpadNotifications.success({
        title: 'External resource updated',
        message: 'The external resource has been updated',
      });
    } catch (error) {
      console.log('Error updating external resource:', error);
      ScratchpadNotifications.error({
        title: 'Failed to update external resource',
        message: 'Please try again',
      });
    } finally {
      setIsExternalResourceUpdating(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <Paper p="md">
        <Alert color="red" title="Error">
          Failed to load Prompt assets
        </Alert>
      </Paper>
    );
  }

  const sortedResources = promptAssets.sort((a, b) => a.name.localeCompare(b.name));

  const resourceIcon = (resource: StyleGuide) => {
    if (resource.contentType === 'markdown') {
      return <FileMdIcon size={20} />;
    }
    if (resource.contentType === 'json') {
      return <FileCodeIcon size={20} />;
    }
    return <FileTextIcon size={20} />;
  };

  return (
    <MainContent>
      <MainContent.BasicHeader title="Prompt assets" />
      <MainContent.Body>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <FileUploadDropzone allowedTypes={['md']}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr h="30px">
                  <Table.Td w="60%">Name</Table.Td>
                  <Table.Td w="15%">Updated</Table.Td>
                  <Table.Td w="15%" align="right">
                    Size
                  </Table.Td>
                  <Table.Td w="15%" align="right">
                    Actions
                  </Table.Td>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedResources.map((styleGuide) => (
                  <Table.Tr
                    key={styleGuide.id}
                    onClick={() => handleEditResource(styleGuide)}
                    style={{ cursor: 'pointer' }}
                    h="30px"
                  >
                    <Table.Td h="30px">
                      <Group gap="sm">
                        {resourceIcon(styleGuide)}
                        <Text13Medium>{styleGuide.name}</Text13Medium>
                        {styleGuide.autoInclude ? <Badge color="blue">Auto Include</Badge> : null}
                        {styleGuide.sourceUrl && <Badge leftSection={<LinkIcon size={12} />}>External</Badge>}
                        {styleGuide.tags.map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text13Regular>{formatDate(styleGuide.updatedAt)}</Text13Regular>
                    </Table.Td>
                    <Table.Td align="right">
                      <Text13Regular>{formatBytes(styleGuide.body.length)}</Text13Regular>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end">
                        {styleGuide.sourceUrl && (
                          <ToolIconButton
                            size="md"
                            tooltip="Redownload external content"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateExternalResource(styleGuide.id);
                            }}
                            loading={isExternalResourceUpdating}
                            icon={DownloadIcon}
                          />
                        )}
                        <ToolIconButton
                          size="md"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setActiveResource(styleGuide);
                            openCreateModal();
                          }}
                          icon={PencilLineIcon}
                        />

                        <ToolIconButton
                          size="md"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveResource(styleGuide);
                            openDeleteModal();
                          }}
                          icon={Trash2Icon}
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </FileUploadDropzone>
        )}

        <Modal title="Confirm delete" centered opened={isDeleteModalOpen} onClose={closeDeleteModal}>
          <Stack gap="sm">
            <Text>Are you sure you want to delete the &quot;{activeResource?.name}&quot; resource?</Text>
            <Group justify="flex-end">
              <ButtonSecondaryOutline onClick={closeDeleteModal}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight
                onClick={() => {
                  if (activeResource) {
                    handleDeleteAsset(activeResource.id);
                  }
                  closeDeleteModal();
                }}
              >
                Delete
              </ButtonPrimaryLight>
            </Group>
          </Stack>
        </Modal>

        <EditResourceModal
          opened={isCreateModalOpen}
          onClose={() => {
            setActiveResource(null);
            closeCreateModal();
          }}
          onSuccess={async () => {
            await mutate();
            setActiveResource(null);
            closeCreateModal();
          }}
          resourceDocument={activeResource}
        />
      </MainContent.Body>
      <MainContent.Footer h={28}>
        <ContentFooterButton leftSection={<PlusIcon size={16} />} onClick={handleNewAsset}>
          New prompt asset
        </ContentFooterButton>
      </MainContent.Footer>
    </MainContent>
  );
}
