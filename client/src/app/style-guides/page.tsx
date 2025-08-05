'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { styleGuideApi } from '@/lib/api/style-guide';
import { RouteUrls } from '@/utils/route-urls';
import { ActionIcon, Alert, Button, Group, Modal, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ContentContainer } from '../components/ContentContainer';

export default function StyleGuidesPage() {
  const { styleGuides, isLoading, error, mutate } = useStyleGuides();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newStyleGuideName, setNewStyleGuideName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreateStyleGuide = async () => {
    if (!newStyleGuideName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const styleGuide = await styleGuideApi.create({
        name: newStyleGuideName.trim(),
        body: '',
      });

      setNewStyleGuideName('');
      setIsCreateModalOpen(false);
      mutate();
      router.push(RouteUrls.styleGuidePage(styleGuide.id));
    } catch (error) {
      setCreateError('Failed to create style guide');
      console.error('Error creating style guide:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteStyleGuide = async (id: string) => {
    if (!confirm('Are you sure you want to delete this style guide?')) return;

    try {
      await styleGuideApi.delete(id);
      mutate();
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

  const headerActions = (
    <Button leftSection={<Plus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
      New Style Guide
    </Button>
  );

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
            {styleGuides.map((styleGuide) => (
              <Table.Tr key={styleGuide.id}>
                <Table.Td>
                  <Link
                    href={RouteUrls.styleGuidePage(styleGuide.id)}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    {styleGuide.name}
                  </Link>
                </Table.Td>
                <Table.Td>{formatDate(styleGuide.createdAt)}</Table.Td>
                <Table.Td>{formatDate(styleGuide.updatedAt)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      component={Link}
                      href={RouteUrls.styleGuidePage(styleGuide.id)}
                      variant="subtle"
                      size="sm"
                    >
                      <PencilSimple size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleDeleteStyleGuide(styleGuide.id)}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Style Guide">
        <Stack>
          {createError && (
            <Alert color="red" title="Error">
              {createError}
            </Alert>
          )}
          <TextInput
            label="Name"
            placeholder="Enter style guide name"
            value={newStyleGuideName}
            onChange={(e) => setNewStyleGuideName(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === 'Enter') {
                handleCreateStyleGuide();
              }
            }}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateStyleGuide} loading={isCreating} disabled={!newStyleGuideName.trim()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </ContentContainer>
  );
}
