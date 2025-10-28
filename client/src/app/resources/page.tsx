'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { styleGuideApi } from '@/lib/api/style-guide';
import { trackClickDownloadResource } from '@/lib/posthog';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { formatBytes } from '@/utils/helpers';
import { Alert, Group, Modal, Paper, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FileCodeIcon, FileMdIcon, FileTextIcon } from '@phosphor-icons/react';
import { DownloadIcon, LinkIcon, PencilLineIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { BadgeBase } from '../components/base/badges';
import { ButtonPrimaryLight, ButtonSecondaryOutline, ContentFooterButton } from '../components/base/buttons';
import { TextMdHeavier, TextSmRegular } from '../components/base/text';
import { EditResourceModal } from '../components/EditResourceModal';
import MainContent from '../components/layouts/MainContent';
import { ScratchpadNotifications } from '../components/ScratchpadNotifications';
import { ToolIconButton } from '../components/ToolIconButton';

export default function StyleGuidesPage() {
  const { styleGuides, isLoading, error, mutate } = useStyleGuides();
  const [isCreateModalOpen, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [isDeleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [isExternalResourceUpdating, setIsExternalResourceUpdating] = useState(false);
  const [activeResource, setActiveResource] = useState<StyleGuide | null>(null);

  const handleEditResource = (resource: StyleGuide) => {
    setActiveResource(resource);
    openCreateModal();
  };

  const handleNewStyleGuide = useCallback(async () => {
    setActiveResource(null);
    openCreateModal();
  }, [openCreateModal]);

  const handleDeleteStyleGuide = async (id: string) => {
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
          Failed to load resources
        </Alert>
      </Paper>
    );
  }

  const sortedResources = styleGuides.sort((a, b) => a.name.localeCompare(b.name));

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
      <MainContent.BasicHeader title="Resources" />
      <MainContent.Body>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
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
                      <TextMdHeavier>{styleGuide.name}</TextMdHeavier>
                      {styleGuide.autoInclude ? <BadgeBase color="blue">Auto Include</BadgeBase> : null}
                      {styleGuide.sourceUrl && <BadgeBase leftSection={<LinkIcon size={12} />}>External</BadgeBase>}
                      {styleGuide.tags.map((tag) => (
                        <BadgeBase key={tag}>{tag}</BadgeBase>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <TextSmRegular>{formatDate(styleGuide.updatedAt)}</TextSmRegular>
                  </Table.Td>
                  <Table.Td align="right">
                    <TextSmRegular>{formatBytes(styleGuide.body.length)}</TextSmRegular>
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
        )}

        <Modal title="Confirm delete" centered opened={isDeleteModalOpen} onClose={closeDeleteModal}>
          <Stack gap="sm">
            <Text>Are you sure you want to delete the &quot;{activeResource?.name}&quot; resource?</Text>
            <Group justify="flex-end">
              <ButtonSecondaryOutline onClick={closeDeleteModal}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight
                onClick={() => {
                  if (activeResource) {
                    handleDeleteStyleGuide(activeResource.id);
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
      <MainContent.Footer>
        <ContentFooterButton leftSection={<PlusIcon size={16} />} onClick={handleNewStyleGuide}>
          New resource
        </ContentFooterButton>
      </MainContent.Footer>
    </MainContent>
  );
}
