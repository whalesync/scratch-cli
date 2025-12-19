import { IconButtonInline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { SWR_KEYS } from '@/lib/api/keys';
import { recordApi } from '@/lib/api/record';
import { SnapshotTable } from '@spinner/shared-types';
import { Group, Menu } from '@mantine/core';
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import pluralize from 'pluralize';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500, 1000] as const;

export const PaginationFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { mutate: globalMutate } = useSWRConfig();

  const { filteredCount, records, startIndex, endIndex, skip, take, hasNextPage, hasPrevPage } =
    useSnapshotTableRecords({
      workbookId: table.workbookId,
      tableId: table.id,
    });

  const handleSetPageSize = useCallback(
    async (pageSize: number | null) => {
      try {
        await recordApi.setTableViewState(table.workbookId, table.id, { pageSize, currentSkip: null });

        // Invalidate caches to refetch data with new page size
        globalMutate(SWR_KEYS.workbook.detail(table.workbookId));
        globalMutate(SWR_KEYS.workbook.list());
        globalMutate(SWR_KEYS.workbook.recordsKeyMatcher(table.workbookId, table.id), undefined, {
          revalidate: true,
        });

        ScratchpadNotifications.success({
          title: 'Page Size Updated',
          message: pageSize === null ? 'Showing all records' : `Showing ${pageSize} records per page`,
        });
      } catch (error) {
        console.error('Error setting page size:', error);
        ScratchpadNotifications.error({
          title: 'Failed to Update Page Size',
          message: error instanceof Error ? error.message : 'Failed to set page size',
        });
      }
    },
    [table.id, table.workbookId, globalMutate],
  );

  const handleNavigate = useCallback(
    async (newSkip: number) => {
      try {
        await recordApi.setTableViewState(table.workbookId, table.id, { currentSkip: newSkip });

        // Invalidate caches to refetch data with new skip
        globalMutate(SWR_KEYS.workbook.recordsKeyMatcher(table.workbookId, table.id), undefined, {
          revalidate: true,
        });
      } catch (error) {
        console.error('Error navigating:', error);
        ScratchpadNotifications.error({
          title: 'Failed to Navigate',
          message: error instanceof Error ? error.message : 'Failed to navigate pages',
        });
      }
    },
    [table.id, table.workbookId, globalMutate],
  );

  // TODO: Handle smarter.
  if (!records) return null;

  const handleNext = () => handleNavigate(skip + take);
  const handlePrev = () => handleNavigate(Math.max(0, skip - take));

  const isAllRecords = !hasPrevPage && !hasNextPage;
  const formattedRange = isAllRecords
    ? `${filteredCount} ${pluralize('record', filteredCount)}`
    : `${startIndex} - ${endIndex} of ${filteredCount} records`;

  return (
    <Group gap={0}>
      {!isAllRecords && (
        <IconButtonInline onClick={handlePrev} disabled={!hasPrevPage}>
          <ChevronLeftIcon size={13} />
        </IconButtonInline>
      )}
      {!isAllRecords && (
        <IconButtonInline onClick={handleNext} disabled={!hasNextPage}>
          <ChevronRightIcon size={13} />
        </IconButtonInline>
      )}
      <Text13Regular pl={isAllRecords ? 'xs' : '0'}>{formattedRange}</Text13Regular>
      <Menu>
        <Menu.Target>
          <IconButtonInline>
            <ChevronDownIcon size={13} />
          </IconButtonInline>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Page Size</Menu.Label>
          {PAGE_SIZE_OPTIONS.map((pageSize) => (
            <Menu.Item
              key={pageSize}
              onClick={() => handleSetPageSize(pageSize)}
              rightSection={pageSize === table.pageSize ? <CheckIcon size={13} /> : null}
            >
              {pageSize} records
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item
            onClick={() => handleSetPageSize(null)}
            rightSection={table.pageSize === null ? <CheckIcon size={13} /> : null}
          >
            All records
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
};
