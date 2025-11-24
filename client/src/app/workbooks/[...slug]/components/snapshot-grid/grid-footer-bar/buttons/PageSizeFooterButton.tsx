import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Menu } from '@mantine/core';
import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { formatNumber } from '../../../../../../../utils/helpers';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500, 1000] as const;

export const PageSizeFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { mutate: globalMutate } = useSWRConfig();

  const currentPageSize = useMemo(() => {
    return table.pageSize ?? 10; // default to 10 if not set
  }, [table.pageSize]);

  const handleSetPageSize = useCallback(
    async (pageSize: number | null) => {
      try {
        await workbookApi.setPageSize(table.workbookId, table.id, pageSize);

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

  return (
    <Menu>
      <Menu.Target>
        <ButtonSecondaryInline>
          {currentPageSize === null ? 'All records' : `${currentPageSize} records`}
        </ButtonSecondaryInline>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Page Size</Menu.Label>
        {PAGE_SIZE_OPTIONS.map((pageSize) => (
          <Menu.Item key={pageSize} onClick={() => handleSetPageSize(pageSize)}>
            {formatNumber(pageSize)} records
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item onClick={() => handleSetPageSize(null)}>All records</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
