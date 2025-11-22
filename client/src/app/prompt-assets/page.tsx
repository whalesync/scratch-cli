'use client';

import { usePromptAssets } from '@/hooks/use-prompt-assets';
import { styleGuideApi } from '@/lib/api/style-guide';
import { trackClickDownloadResource } from '@/lib/posthog';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { Alert, Badge, Group, Menu, Modal, Paper, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { capitalize } from 'lodash';
import {
  DownloadIcon,
  Edit3Icon,
  FileCodeIcon,
  FileTextIcon,
  FileTypeIcon,
  LinkIcon,
  PlusIcon,
  Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { StyleGuideId } from '../../types/server-entities/ids';
import { formatBytes } from '../../utils/helpers';
import { ActionIconThreeDots } from '../components/base/action-icons';
import { ButtonPrimaryLight, ButtonPrimarySolid, ButtonSecondaryOutline } from '../components/base/buttons';
import { EditResourceModal } from '../components/EditResourceModal';
import MainContent from '../components/layouts/MainContent';
import { RelativeDate } from '../components/RelativeDate';
import { ScratchpadNotifications } from '../components/ScratchpadNotifications';

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
      return <FileTypeIcon size={20} />;
    }
    if (resource.contentType === 'json') {
      return <FileCodeIcon size={20} />;
    }
    return <FileTextIcon size={20} />;
  };

  return (
    <MainContent>
      <MainContent.BasicHeader
        title="Prompt assets"
        actions={
          <ButtonPrimarySolid onClick={handleNewAsset} leftSection={<PlusIcon />}>
            New asset
          </ButtonPrimarySolid>
        }
      />
      <MainContent.Body>
        {isLoading ? (
          <Text>Loading...</Text>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr h="30px">
                <Table.Td w="50%">Name</Table.Td>
                <Table.Td w="15%">File size</Table.Td>
                <Table.Td w="10%">Kind</Table.Td>
                <Table.Td w="15%">Created</Table.Td>
                <Table.Td w="10%" align="right">
                  {/* Actions */}
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
                      {styleGuide.name}
                      {styleGuide.autoInclude ? <Badge color="blue">Auto Include</Badge> : null}
                      {styleGuide.sourceUrl && <Badge leftSection={<LinkIcon size={12} />}>External</Badge>}
                      {styleGuide.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>{formatBytes(styleGuide.body.length)}</Table.Td>
                  <Table.Td>{capitalize(styleGuide.contentType)}</Table.Td>
                  <Table.Td>
                    <RelativeDate date={styleGuide.createdAt} />
                  </Table.Td>
                  <Table.Td align="right">
                    <Menu>
                      <Menu.Target>
                        {/* Prevent the menu clicking the underlying table row */}
                        <div onClick={(e) => e.stopPropagation()} style={{ width: 'fit-content' }}>
                          <ActionIconThreeDots />
                        </div>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<Edit3Icon size={16} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveResource(styleGuide);
                            openCreateModal();
                          }}
                        >
                          Edit
                        </Menu.Item>

                        {styleGuide.sourceUrl && (
                          <Menu.Item
                            leftSection={<DownloadIcon size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateExternalResource(styleGuide.id);
                            }}
                            disabled={isExternalResourceUpdating}
                          >
                            {isExternalResourceUpdating ? 'Updating...' : 'Redownload external content'}
                          </Menu.Item>
                        )}
                        <Menu.Divider />
                        <Menu.Item
                          data-delete
                          leftSection={<Trash2 size={16} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveResource(styleGuide);
                            openDeleteModal();
                          }}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
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
    </MainContent>
  );
}
