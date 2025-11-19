import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Menu } from '@mantine/core';
import { useCallback, useMemo } from 'react';
import { useSWRConfig } from 'swr';

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
        <Menu.Item onClick={() => handleSetPageSize(10)}>10 records</Menu.Item>
        <Menu.Item onClick={() => handleSetPageSize(25)}>25 records</Menu.Item>
        <Menu.Item onClick={() => handleSetPageSize(50)}>50 records</Menu.Item>
        <Menu.Item onClick={() => handleSetPageSize(100)}>100 records</Menu.Item>
        <Menu.Item onClick={() => handleSetPageSize(500)}>500 records</Menu.Item>
        <Menu.Item onClick={() => handleSetPageSize(1000)}>1,000 records</Menu.Item>
        <Menu.Divider />
        <Menu.Item onClick={() => handleSetPageSize(null)}>All records</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
