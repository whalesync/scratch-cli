'use client';

import { useCsvFiles } from '@/hooks/use-csv-file';
import { ActionIcon, Alert, Button, Group, Modal, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CsvFilesPage() {
  const { csvFiles, isLoading, error, createCsvFile, deleteCsvFile } = useCsvFiles();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCsvFileName, setNewCsvFileName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreateCsvFile = async () => {
    if (!newCsvFileName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const csvFile = await createCsvFile({
        name: newCsvFileName.trim(),
        body: '',
      });

      setNewCsvFileName('');
      setIsCreateModalOpen(false);
      router.push(`/csv-files/${csvFile.id}`);
    } catch (error) {
      setCreateError('Failed to create CSV file');
      console.error('Error creating CSV file:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCsvFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this CSV file?')) return;

    try {
      await deleteCsvFile(id);
    } catch (error) {
      console.error('Error deleting CSV file:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return (
      <Paper p="md">
        <Alert color="red" title="Error">
          Failed to load CSV files
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={2}>CSV Files</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
          New CSV File
        </Button>
      </Group>

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
            {csvFiles.map((csvFile) => (
              <Table.Tr key={csvFile.id}>
                <Table.Td>
                  <Link href={`/csv-files/${csvFile.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <Text fw={500}>{csvFile.name}</Text>
                  </Link>
                </Table.Td>
                <Table.Td>{formatDate(csvFile.createdAt)}</Table.Td>
                <Table.Td>{formatDate(csvFile.updatedAt)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon variant="light" color="blue" component={Link} href={`/csv-files/${csvFile.id}`}>
                      <PencilSimple size={16} />
                    </ActionIcon>
                    <ActionIcon variant="light" color="red" onClick={() => handleDeleteCsvFile(csvFile.id)}>
                      <Trash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal
        opened={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New CSV File"
        size="md"
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="Enter CSV file name"
            value={newCsvFileName}
            onChange={(e) => setNewCsvFileName(e.target.value)}
            autoFocus
          />
          {createError && (
            <Alert color="red" title="Error">
              {createError}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCsvFile} loading={isCreating} disabled={!newCsvFileName.trim()}>
              Create
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  );
}
