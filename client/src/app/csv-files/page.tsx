'use client';

import { useCsvFiles } from '@/hooks/use-csv-file';
import { CsvFile } from '@/types/server-entities/csv-file';
import { Center, Group, Loader, Modal, Stack, Table, Text, UnstyledButton, useModalsStack } from '@mantine/core';
import { Edit3Icon, FileSpreadsheet, Plus, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { ContentFooterButton, PrimaryButton, SecondaryButton } from '../components/base/buttons';
import { TextRegularSm, TextTitleSm } from '../components/base/text';
import { StyledLucideIcon } from '../components/Icons/StyledLucideIcon';
import { ErrorInfo } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { ScratchpadNotifications } from '../components/ScratchpadNotifications';
import { ToolIconButton } from '../components/ToolIconButton';
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

  return (
    <MainContent>
      <MainContent.BasicHeader title="CSV Files" />
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
                      <UnstyledButton
                        fz="sm"
                        onClick={() => {
                          setSelectedCsvFile(csvFile);
                          modalStack.open('edit');
                        }}
                      >
                        <Group gap="sm">
                          <StyledLucideIcon Icon={FileSpreadsheet} size="md" />
                          <TextTitleSm>{csvFile.name}</TextTitleSm>
                        </Group>
                      </UnstyledButton>
                    </Table.Td>
                    <Table.Td>{formatDate(csvFile.createdAt)}</Table.Td>
                    <Table.Td>{formatDate(csvFile.updatedAt)}</Table.Td>
                    <Table.Td w="15%" align="right">
                      <Group gap="xs" justify="flex-end">
                        <ToolIconButton
                          onClick={() => {
                            setSelectedCsvFile(csvFile);
                            modalStack.open('edit');
                          }}
                          icon={Edit3Icon}
                          size="md"
                        />
                        <ToolIconButton
                          onClick={() => {
                            setSelectedCsvFile(csvFile);
                            modalStack.open('delete');
                          }}
                          icon={Trash2Icon}
                          size="md"
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
      </MainContent.Body>
      <MainContent.Footer>
        <ContentFooterButton
          leftSection={<StyledLucideIcon Icon={Plus} size="md" />}
          onClick={() => {
            setSelectedCsvFile(null);
            modalStack.open('edit');
          }}
        >
          New CSV File
        </ContentFooterButton>
      </MainContent.Footer>
    </MainContent>
  );
}
