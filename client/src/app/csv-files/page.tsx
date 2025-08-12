'use client';

import { useCsvFiles } from '@/hooks/use-csv-file';
import { CsvFile } from '@/types/server-entities/csv-file';
import {
  ActionIcon,
  Button,
  Center,
  Group,
  Loader,
  Modal,
  Stack,
  Table,
  Text,
  UnstyledButton,
  useModalsStack,
} from '@mantine/core';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../components/base/buttons';
import { TextRegularSm } from '../components/base/text';
import { ContentContainer } from '../components/ContentContainer';
import { ErrorInfo } from '../components/InfoPanel';
import { ScratchpadNotifications } from '../components/ScratchpadNotifications';
import { EditCsvFileModal } from './components/EditCsvFileModal';

export default function CsvFilesPage() {
  const { csvFiles, isLoading, error, deleteCsvFile } = useCsvFiles();
  const modalStack = useModalsStack(['edit', 'delete']);
  const [selectedCsvFile, setSelectedCsvFile] = useState<CsvFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteCsvFile = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteCsvFile(id);
      ScratchpadNotifications.success({
        title: 'CSV file deleted',
        message: 'The CSV file has been deleted.',
      });
    } catch (error) {
      console.error('Error deleting CSV file:', error);
      ScratchpadNotifications.error({
        title: 'Error deleting CSV file',
        message: 'An error occurred while deleting the CSV file.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (error) {
    return <ErrorInfo error={error} />;
  }

  const headerActions = (
    <Button
      size="xs"
      leftSection={<PlusIcon size={16} />}
      onClick={() => {
        setSelectedCsvFile(null);
        modalStack.open('edit');
      }}
    >
      New CSV File
    </Button>
  );

  return (
    <ContentContainer title="CSV Files" actions={headerActions}>
      {isLoading ? (
        <Center>
          <Group>
            <Loader size="sm" />
            <TextRegularSm>Loading...</TextRegularSm>
          </Group>
        </Center>
      ) : (
        <>
          <EditCsvFileModal csvFile={selectedCsvFile} {...modalStack.register('edit')} />
          <Modal title="Delete CSV File" size="md" centered {...modalStack.register('delete')}>
            <Stack>
              <Text>Are you sure you want to delete this CSV file?</Text>
              <Group justify="flex-end">
                <SecondaryButton
                  onClick={() => {
                    modalStack.close('delete');
                    setSelectedCsvFile(null);
                  }}
                >
                  Cancel
                </SecondaryButton>
                <PrimaryButton
                  onClick={() => {
                    if (!selectedCsvFile) return;
                    handleDeleteCsvFile(selectedCsvFile.id);
                    modalStack.close('delete');
                    setSelectedCsvFile(null);
                  }}
                  loading={isDeleting}
                >
                  Delete
                </PrimaryButton>
              </Group>
            </Stack>
          </Modal>
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
                    <UnstyledButton
                      onClick={() => {
                        setSelectedCsvFile(csvFile);
                        modalStack.open('edit');
                      }}
                    >
                      <Text fw={500}>{csvFile.name}</Text>
                    </UnstyledButton>
                  </Table.Td>
                  <Table.Td>{formatDate(csvFile.createdAt)}</Table.Td>
                  <Table.Td>{formatDate(csvFile.updatedAt)}</Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => {
                          setSelectedCsvFile(csvFile);
                          modalStack.open('edit');
                        }}
                      >
                        <PencilSimpleIcon size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => {
                          setSelectedCsvFile(csvFile);
                          modalStack.open('delete');
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
        </>
      )}
    </ContentContainer>
  );
}
