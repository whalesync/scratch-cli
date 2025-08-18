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
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useCallback, useState } from 'react';
import { ContentContainer } from '../components/ContentContainer';
import { EditResourceModal } from '../components/EditResourceModal';

export default function StyleGuidesPage() {
  const { styleGuides, isLoading, error, mutate } = useStyleGuides();
  const [isCreateModalOpen, { open: openCreateModal, close: closeCreateModal }] = useDisclosure(false);
  const [isDeleteModalOpen, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [activeStyleGuide, setActiveStyleGuide] = useState<StyleGuide | null>(null);

  const handleEditStyleGuide = (styleGuide: StyleGuide) => {
    setActiveStyleGuide(styleGuide);
    openCreateModal();
  };

  const handleNewStyleGuide = useCallback(async () => {
    setActiveStyleGuide(null);
    openCreateModal();
  }, []);

  const handleDeleteStyleGuide = async (id: string) => {
    try {
      await styleGuideApi.delete(id);
      setActiveStyleGuide(null);
      await mutate();
    } catch (error) {
      console.log('Error deleting style guide:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <Paper p="md">
        <Alert color="red" title="Error">
          Failed to load style guides
        </Alert>
      </Paper>
    );
  }

  const headerActions = (
    <Button leftSection={<PlusIcon size={16} />} onClick={handleNewStyleGuide}>
      New Style Guide
    </Button>
  );

  const sortedStyleGuides = styleGuides.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ContentContainer title="Style Guides" actions={headerActions}>
      {isLoading ? (
        <Text>Loading...</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Updated</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedStyleGuides.map((styleGuide) => (
              <Table.Tr key={styleGuide.id}>
                <Table.Td>
                  <Group gap="sm">
                    <UnstyledButton fz="sm" onClick={() => handleEditStyleGuide(styleGuide)}>
                      {styleGuide.name}
                    </UnstyledButton>
                    {styleGuide.autoInclude ? (
                      <Badge size="xs" color="blue" variant="light">
                        Auto Include
                      </Badge>
                    ) : null}
                  </Group>
                </Table.Td>

                <Table.Td>{formatDate(styleGuide.createdAt)}</Table.Td>
                <Table.Td>{formatDate(styleGuide.updatedAt)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      onClick={async () => {
                        setActiveStyleGuide(styleGuide);
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
                        setActiveStyleGuide(styleGuide);
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
          <Text>Are you sure you want to delete the &quot;{activeStyleGuide?.name}&quot; resource?</Text>
          <Group justify="flex-end">
            <Button onClick={closeDeleteModal}>Cancel</Button>
            <Button
              onClick={() => {
                if (activeStyleGuide) {
                  handleDeleteStyleGuide(activeStyleGuide.id);
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
          setActiveStyleGuide(null);
          closeCreateModal();
        }}
        onSuccess={async () => {
          await mutate();
          setActiveStyleGuide(null);
          closeCreateModal();
        }}
        styleGuide={activeStyleGuide}
      />
    </ContentContainer>
  );
}
