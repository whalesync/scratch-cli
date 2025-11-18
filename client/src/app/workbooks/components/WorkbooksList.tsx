'use client';

import MainContent from '@/app/components/layouts/MainContent';
import { useWorkbooks } from '@/hooks/use-workbooks';
import { ScratchpadApiError } from '@/lib/api/error';
import { Center, Divider, Loader, Table } from '@mantine/core';
import { SWRConfig } from 'swr';
import { ErrorInfo } from '../../components/InfoPanel';
import { CreateWorkbookButton } from './CreateWorkbookButton';
import { WorkbookRow } from './WorkbookRow';

export const WorkbooksList = () => {
  const { workbooks, isLoading, error } = useWorkbooks();

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return <ErrorInfo error={error} title="Error loading workbooks" />;
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
        <MainContent.BasicHeader title="Workbooks" actions={<CreateWorkbookButton />} />
        <MainContent.Body>
          <Divider />
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Td w="40%">Name</Table.Td>
                <Table.Td w="20%">Data sources</Table.Td>
                <Table.Td w="25%">Created</Table.Td>
                <Table.Td w="15%"> </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {workbooks?.map((w) => (
                <WorkbookRow key={w.id} workbook={w} />
              ))}
            </Table.Tbody>
          </Table>
        </MainContent.Body>
      </MainContent>
    </SWRConfig>
  );
};
