'use client';

import { ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { Center, Group, Loader, Modal, Stack, Table, Text, useModalsStack } from '@mantine/core';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useConnectorAccounts } from '../../hooks/use-connector-account';
import { ButtonPrimaryLight, ButtonSecondaryOutline, ContentFooterButton } from '../components/base/buttons';
import { TextSmRegular } from '../components/base/text';
import { ErrorInfo } from '../components/InfoPanel';
import MainContent from '../components/layouts/MainContent';
import { ScratchpadNotifications } from '../components/ScratchpadNotifications';
import { ConnectorRow } from './components/ConnectorRow';
import { CreateConnectionModal } from './components/CreateConnectionModal';
import { UpdateConnectionModal } from './components/UpdateConnectionModal';

export default function ConnectorAccountsPage() {
  const { isLoading, error, connectorAccounts, deleteConnectorAccount, testConnection } = useConnectorAccounts();

  // State for the update modal
  const [selectedConnectorAccount, setSelectedConnectorAccount] = useState<ConnectorAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const modalStack = useModalsStack(['create', 'update', 'confirm-delete']);

  const handleTest = async (id: string) => {
    setTestingId(id);
    await testConnection(id);
    setTestingId(null);
  };

  const handleDelete = async () => {
    if (!selectedConnectorAccount) return;
    setIsDeleting(true);
    try {
      await deleteConnectorAccount(selectedConnectorAccount.id);
      setSelectedConnectorAccount(null);
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Error',
        message: 'Failed to delete connection.',
        autoClose: 5000,
      });
    } finally {
      setIsDeleting(false);
      modalStack.close('confirm-delete');
    }
  };

  if (isLoading) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Connections" />
        <MainContent.Body>
          <Center h="100%">
            <Loader />
            <TextSmRegular>Loading connections...</TextSmRegular>
          </Center>
        </MainContent.Body>
      </MainContent>
    );
  }

  if (error) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Connections" />
        <MainContent.Body>
          <ErrorInfo error={error} />
        </MainContent.Body>
      </MainContent>
    );
  }

  const sortedConnectorAccounts = connectorAccounts?.sort((a, b) => a.displayName.localeCompare(b.displayName)) || [];

  return (
    <MainContent>
      <MainContent.BasicHeader title="Connections" />
      <MainContent.Body>
        <CreateConnectionModal {...modalStack.register('create')} />
        <UpdateConnectionModal {...modalStack.register('update')} connectorAccount={selectedConnectorAccount} />
        <Modal {...modalStack.register('confirm-delete')} title="Delete Connection" centered size="lg">
          <Stack>
            <Text>Are you sure you want to delete this connection and associated scratchpapers?</Text>
            <Group justify="flex-end">
              <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight onClick={handleDelete} loading={isDeleting}>
                Delete
              </ButtonPrimaryLight>
            </Group>
          </Stack>
        </Modal>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Td>Name</Table.Td>
              <Table.Td>Status</Table.Td>
              <Table.Td>Workbooks</Table.Td>
              <Table.Td>Created</Table.Td>
              <Table.Td> {/* Actions */} </Table.Td>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedConnectorAccounts.map((conn) => (
              <ConnectorRow
                key={conn.id}
                connectorAccount={conn}
                onTest={handleTest}
                onUpdate={(conn) => {
                  setSelectedConnectorAccount(conn);
                  modalStack.open('update');
                }}
                onDelete={() => {
                  setSelectedConnectorAccount(conn);
                  modalStack.open('confirm-delete');
                }}
                testingId={testingId}
              />
            ))}
          </Table.Tbody>
        </Table>
      </MainContent.Body>
      <MainContent.Footer>
        <ContentFooterButton leftSection={<PlusIcon size={16} />} onClick={() => modalStack.open('create')}>
          New connection
        </ContentFooterButton>
      </MainContent.Footer>
    </MainContent>
  );
}
