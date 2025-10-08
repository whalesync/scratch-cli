'use client';

import MainContent from '@/app/components/layouts/MainContent';
import { useSnapshots } from '@/hooks/use-snapshot';
import { ScratchpadApiError } from '@/lib/api/error';
import { Center, Loader, Table } from '@mantine/core';
import { SWRConfig } from 'swr';
import { ErrorInfo } from '../../components/InfoPanel';
import { CreateSnapshotPanel } from './CreateSnapshotPanel';
import { SnapshotRow } from './SnapshotRow';

export const SnapshotsList = () => {
  const { snapshots, isLoading, error } = useSnapshots();

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return <ErrorInfo error={error} title="Error loading snapshots" />;
  }

  return (
    <SWRConfig
      value={{
        onErrorRetry: (err, key, config, revalidate, { retryCount }) => {
          if (retryCount > 3) {
            return;
          }

          if (err instanceof ScratchpadApiError && err.statusCode === 401) {
            // 401 is the error code for unauthorized
            setTimeout(() => {
              revalidate();
            }, 1000);
          }
        },
      }}
    >
      <MainContent>
        <MainContent.BasicHeader title="Scratchpapers" />
        <MainContent.Body p="0">
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Td w="35%">Name</Table.Td>
                <Table.Td w="20%">Connector</Table.Td>
                <Table.Td w="15%">Objects</Table.Td>
                <Table.Td w="20%">Created</Table.Td>
                <Table.Td w="10%" align="right">
                  Actions
                </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {snapshots?.map((snapshot) => (
                <SnapshotRow key={snapshot.id} snapshot={snapshot} />
              ))}
            </Table.Tbody>
          </Table>
        </MainContent.Body>
        <MainContent.Footer>
          <CreateSnapshotPanel />
        </MainContent.Footer>
      </MainContent>
    </SWRConfig>
  );
};
