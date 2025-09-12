'use client';

import { useCsvFiles } from '@/hooks/use-csv-file';
import { CsvFile } from '@/types/server-entities/csv-file';
import {
  ActionIcon,
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
import { FileCsvIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { PrimaryButton, SecondaryButton } from '../components/base/buttons';
import { TextRegularSm } from '../components/base/text';
import { ErrorInfo } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
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
    <SecondaryButton
      size="xs"
      leftSection={<PlusIcon size={12} />}
      onClick={() => {
        setSelectedCsvFile(null);
        modalStack.open('edit');
      }}
    >
      New CSV File
    </SecondaryButton>
  );

  return (
    <MainContent>
      <MainContent.BasicHeader title="CSV Files" actions={headerActions} />
      <MainContent.Body>
        {isLoading ? (
          <Center>
            <Group gap="xs">
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
                  <Table.Td w="60%">Name</Table.Td>
                  <Table.Td w="15%">Created</Table.Td>
                  <Table.Td w="15%">Updated</Table.Td>
                  <Table.Td w="15%" align="right">
                    Actions
                  </Table.Td>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {csvFiles.map((csvFile) => (
                  <Table.Tr key={csvFile.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <FileCsvIcon size={20} />
                        <UnstyledButton
                          fz="sm"
                          onClick={() => {
                            setSelectedCsvFile(csvFile);
                            modalStack.open('edit');
                          }}
                        >
                          {csvFile.name}
                        </UnstyledButton>
                      </Group>
                    </Table.Td>
                    <Table.Td>{formatDate(csvFile.createdAt)}</Table.Td>
                    <Table.Td>{formatDate(csvFile.updatedAt)}</Table.Td>
                    <Table.Td w="15%" align="right">
                      <Group gap="xs" justify="flex-end">
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
      </MainContent.Body>
    </MainContent>
  );
}
