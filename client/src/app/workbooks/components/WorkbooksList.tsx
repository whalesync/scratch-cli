'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import MainContent from '@/app/components/layouts/MainContent';
import { useWorkbooks } from '@/hooks/use-workbooks';
import { ScratchpadApiError } from '@/lib/api/error';
import { WorkbookSortBy, WorkbookSortOrder } from '@/lib/api/workbook';
import { Center, Divider, Group, Loader, Table } from '@mantine/core';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SWRConfig } from 'swr';
import { EmptyListInfoPanel, ErrorInfo } from '../../components/InfoPanel';
import { CreateWorkbookButton } from './CreateWorkbookButton';
import { WorkbookRow } from './WorkbookRow';

const isValidSortBy = (value: string | null): value is WorkbookSortBy => {
  return value === 'name' || value === 'createdAt' || value === 'updatedAt';
};

const isValidSortOrder = (value: string | null): value is WorkbookSortOrder => {
  return value === 'asc' || value === 'desc';
};

export const WorkbooksList = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortByParam = searchParams.get('sortBy');
  const sortOrderParam = searchParams.get('sortOrder');

  const sortBy: WorkbookSortBy = isValidSortBy(sortByParam) ? sortByParam : 'createdAt';
  const sortOrder: WorkbookSortOrder = isValidSortOrder(sortOrderParam) ? sortOrderParam : 'desc';

  const { workbooks, isLoading, error, refreshWorkbooks } = useWorkbooks({ sortBy, sortOrder });

  const handleSort = (column: WorkbookSortBy) => {
    const params = new URLSearchParams(searchParams.toString());

    if (sortBy === column) {
      params.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      params.set('sortBy', column);
      params.set('sortOrder', column === 'name' ? 'asc' : 'desc');
    }

    router.push(`/workbooks?${params.toString()}`);
  };

  const SortableHeader = ({ column, children }: { column: WorkbookSortBy; children: React.ReactNode }) => (
    <Group gap={4} onClick={() => handleSort(column)} style={{ cursor: 'pointer', display: 'inline-flex' }}>
      {children}
      {sortBy === column && (
        <StyledLucideIcon Icon={sortOrder === 'asc' ? ArrowUp : ArrowDown} size="sm" c="var(--fg-muted)" />
      )}
    </Group>
  );

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  return (
    <SWRConfig
      value={{
        onErrorRetry: (err, key, config, revalidate, { retryCount }) => {
          console.log('onErrorRetry', err, key, config, revalidate, retryCount);
          if (retryCount > 3) {
            return;
          }

          if (err instanceof ScratchpadApiError && err.statusCode === 401) {
            // 401 is the error code for unauthorized and can occure when the token expires
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
                <Table.Td w="40%">
                  <SortableHeader column="name">Name</SortableHeader>
                </Table.Td>
                <Table.Td w="20%">Data sources</Table.Td>
                <Table.Td w="25%">
                  <SortableHeader column="createdAt">Created</SortableHeader>
                </Table.Td>
                <Table.Td w="15%"> </Table.Td>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {error && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <ErrorInfo
                      error={error}
                      title="Error loading workbooks"
                      description="There was an issue loading your workbooks. Click the retry button to try again."
                      retry={refreshWorkbooks}
                    />
                  </Table.Td>
                </Table.Tr>
              )}

              {workbooks?.map((w) => (
                <WorkbookRow key={w.id} workbook={w} />
              ))}
              {!error && workbooks?.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={3}>
                    <EmptyListInfoPanel
                      title="No workbooks found"
                      description="Create a new workbook to get started"
                      actionButton={<CreateWorkbookButton size="xs" variant="light" />}
                    />
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </MainContent.Body>
      </MainContent>
    </SWRConfig>
  );
};
