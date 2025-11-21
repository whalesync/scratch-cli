'use client';

import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { serviceName } from '@/service-naming-conventions';
import { OAuthService } from '@/types/oauth';
import { AuthType, ConnectorAccount } from '@/types/server-entities/connector-accounts';
import { initiateOAuth } from '@/utils/oauth';
import { Alert, Group, Loader, LoadingOverlay, Modal, Stack, Table, Text, useModalsStack } from '@mantine/core';
import { ArrowDown, ArrowUp, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useConnectorAccounts } from '../../../hooks/use-connector-account';
import { usePersistedSort } from '../../../hooks/use-persisted-sort';
import { ButtonPrimaryLight, ButtonPrimarySolid, ButtonSecondaryOutline } from '../../components/base/buttons';
import { TextMono13Regular } from '../../components/base/text';
import { ErrorInfo } from '../../components/InfoPanel';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';
import { ConnectorRow } from './ConnectorRow';
import { CreateConnectionModal } from './CreateConnectionModal';
import { UpdateConnectionModal } from './UpdateConnectionModal';

export default function ConnectorTable() {
  const { isLoading, error, connectorAccounts, deleteConnectorAccount, testConnection } = useConnectorAccounts();

  // State for the update modal
  const [selectedConnectorAccount, setSelectedConnectorAccount] = useState<ConnectorAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const modalStack = useModalsStack(['create', 'update', 'confirm-delete']);

  const handleTest = async (con: ConnectorAccount) => {
    setTestingId(con.id);
    await testConnection(con);
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
        message: 'Failed to delete connection',
        autoClose: 5000,
      });
    } finally {
      setIsDeleting(false);
      modalStack.close('confirm-delete');
    }
  };

  const {
    sortedItems: sortedConnectorAccounts,
    sort,
    handleSort,
  } = usePersistedSort<ConnectorAccount>(connectorAccounts, 'connector-table-sort', {
    field: 'createdAt',
    direction: 'desc',
  });

  const handleReauthorize = async (connectorAccount: ConnectorAccount) => {
    if (connectorAccount.authType !== AuthType.OAUTH) {
      // Only necessary for OAuth connections
      return;
    }

    /*
     * This turns on a temporary overlay until the OAuth does the first redirect to the service
     * just in case the server is lagging when generating the OAuth URL.
     */
    setIsReauthorizing(true);
    setSelectedConnectorAccount(connectorAccount); // used in the loading overlay

    setOauthError(null);
    try {
      await initiateOAuth(connectorAccount.service as OAuthService, {
        redirectPrefix: `${window.location.protocol}//${window.location.host}`,
        connectionMethod: 'OAUTH_SYSTEM',
        connectionName: connectorAccount.displayName,
        returnPage: window.location.pathname,
        // setting the connector ID is what makes this a reauthorization
        connectorAccountId: connectorAccount.id,
      });
      // The initiateOAuth function will redirect the user, so we don't need to do anything else here
    } catch (error) {
      console.error('OAuth initiation failed:', error);
      setOauthError('Failed to start OAuth flow. Please try again.');
    } finally {
      setIsReauthorizing(false);
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return <ErrorInfo error={error} />;
  }

  return (
    <>
      <CreateConnectionModal {...modalStack.register('create')} />
      <UpdateConnectionModal {...modalStack.register('update')} connectorAccount={selectedConnectorAccount} />
      <Modal {...modalStack.register('confirm-delete')} title="Delete data source" centered size="lg">
        <Stack>
          <Text>Are you sure you want to delete this data source and associated workbooks?</Text>
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleDelete} loading={isDeleting}>
              Delete
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      {oauthError && <Alert color="red">{oauthError}</Alert>}

      <LoadingOverlay
        visible={isReauthorizing}
        loaderProps={{
          children: (
            <LoaderWithMessage
              message={`Reauthorizing connection to ${selectedConnectorAccount ? serviceName(selectedConnectorAccount.service) : 'data source'}...`}
            />
          ),
        }}
      />
      <Group justify="space-between" align="top" mt="md">
        <TextMono13Regular c="dimmed">CONNECTED APPS</TextMono13Regular>
        <ButtonPrimarySolid leftSection={<PlusIcon />} onClick={() => modalStack.open('create')}>
          New connection
        </ButtonPrimarySolid>
      </Group>

      <Table ml="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Td onClick={() => handleSort('displayName')} style={{ cursor: 'pointer' }}>
              <Group gap="xs">
                Name
                {sort.field === 'displayName' &&
                  (sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
              </Group>
            </Table.Td>
            <Table.Td w="10%">Type</Table.Td>
            <Table.Td w="20%">Status</Table.Td>
            <Table.Td w="20%" onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
              <Group gap="xs">
                Created
                {sort.field === 'createdAt' &&
                  (sort.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
              </Group>
            </Table.Td>
            <Table.Td w="120px" align="right"></Table.Td>
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
              onReauthorize={() => handleReauthorize(conn)}
              testingId={testingId}
            />
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
