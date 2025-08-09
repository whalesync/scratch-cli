'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { styleGuideApi } from '@/lib/api/style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { ActionIcon, Alert, Badge, Button, Group, Paper, Table, Text, UnstyledButton } from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { ContentContainer } from '../components/ContentContainer';
import { EditResourceModal } from '../components/EditResourceModal';

export default function StyleGuidesPage() {
  const { styleGuides, isLoading, error, mutate } = useStyleGuides();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeStyleGuide, setActiveStyleGuide] = useState<StyleGuide | null>(null);

  const handleDeleteStyleGuide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this style guide?')) return;

    try {
      await styleGuideApi.delete(id);
      await mutate();
    } catch (error) {
      console.error('Error deleting style guide:', error);
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

  const handleEditStyleGuide = (styleGuide: StyleGuide) => {
    setActiveStyleGuide(styleGuide);
    setIsCreateModalOpen(true);
  };

  const headerActions = (
    <Button
      leftSection={<PlusIcon size={16} />}
      onClick={() => {
        setActiveStyleGuide(null);
        setIsCreateModalOpen(true);
      }}
    >
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
                        setIsCreateModalOpen(true);
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
                      onClick={() => handleDeleteStyleGuide(styleGuide.id)}
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

      <EditResourceModal
        opened={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setActiveStyleGuide(null);
        }}
        onSuccess={async () => {
          await mutate();
          setIsCreateModalOpen(false);
          setActiveStyleGuide(null);
        }}
        styleGuide={activeStyleGuide}
      />
    </ContentContainer>
  );
}
