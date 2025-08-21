'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { styleGuideApi } from '@/lib/api/style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FileCodeIcon, FileMdIcon, FileTextIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { ContentContainer } from '../components/ContentContainer';
import { EditResourceModal } from '../components/EditResourceModal';

export default function StyleGuidesPage() {
  const { styleGuides, isLoading, error, mutate } = useStyleGuides();
  const [isCreateModalOpen, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [isDeleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [activeResource, setActiveResource] = useState<StyleGuide | null>(null);

  const handleEditResource = (resource: StyleGuide) => {
    setActiveResource(resource);
    openCreateModal();
  };

  const handleNewStyleGuide = useCallback(async () => {
    setActiveResource(null);
    openCreateModal();
  }, []);

  const handleDeleteStyleGuide = async (id: string) => {
    try {
      await styleGuideApi.delete(id);
      setActiveResource(null);
      await mutate();
    } catch (error) {
      console.log('Error deleting resource:', error);
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

  const headerActions = (
    <Button leftSection={<PlusIcon size={16} />} onClick={handleNewStyleGuide}>
      New resource
    </Button>
  );

  const sortedResources = styleGuides.sort((a, b) => a.name.localeCompare(b.name));

  const resourceIcon = (resource: StyleGuide) => {
    if (resource.contentType === 'markdown') {
      return <FileMdIcon size={16} />;
    }
    if (resource.contentType === 'json') {
      return <FileCodeIcon size={16} />;
    }
    return <FileTextIcon size={16} />;
  };

  return (
    <ContentContainer title="Resources" actions={headerActions}>
      {isLoading ? (
        <Text>Loading...</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w="50%">Name</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Updated</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedResources.map((styleGuide) => (
              <Table.Tr key={styleGuide.id}>
                <Table.Td>
                  <Group gap="sm">
                    {resourceIcon(styleGuide)}
                    <UnstyledButton fz="sm" onClick={() => handleEditResource(styleGuide)}>
                      {styleGuide.name}
                    </UnstyledButton>
                    {styleGuide.autoInclude ? (
                      <Badge size="xs" color="blue" variant="light">
                        Auto Include
                      </Badge>
                    ) : null}
                    {styleGuide.tags.map((tag) => (
                      <Badge size="xs" color="gray.6" variant="light" key={tag}>
                        {tag}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>

                <Table.Td>{formatDate(styleGuide.createdAt)}</Table.Td>
                <Table.Td>{formatDate(styleGuide.updatedAt)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      onClick={async () => {
                        setActiveResource(styleGuide);
                        openCreateModal();
                      }}
                      variant="subtle"
                      size="sm"
                    >
                      <PencilSimpleIcon size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => {
                        setActiveResource(styleGuide);
                        openDeleteModal();
                      }}
                    >
                      <TrashIcon size={16} />
                    </ActionIcon>
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
            <Button onClick={closeDeleteModal}>Cancel</Button>
            <Button
              onClick={() => {
                if (activeResource) {
                  handleDeleteStyleGuide(activeResource.id);
                }
                closeDeleteModal();
              }}
            >
              Delete
            </Button>
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
    </ContentContainer>
  );
}
