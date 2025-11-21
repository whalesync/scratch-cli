import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Menu } from '@mantine/core';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useActiveWorkbook } from '../../../../../../../hooks/use-active-workbook';
import { getColumnTypeIcon } from '../../../../../../../utils/columns';

export const ColumnsFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { hideColumn, unhideColumn, showAllColumns } = useActiveWorkbook();

  const hiddenCount = table.hiddenColumns.length;
  const totalCount = table.tableSpec.columns.length;

  // TODO: Maybe add another endpoint like showAllColumns to handle this more elegantly.
  const hideAllColumns = useCallback(async () => {
    for (const column of table.tableSpec.columns) {
      await hideColumn(table.id, column.id.wsId);
    }
  }, [table.id, table.tableSpec.columns, hideColumn]);

  const buttonText = useMemo(() => {
    if (hiddenCount === 0) {
      return 'All columns';
    } else {
      return `${totalCount - hiddenCount} of ${totalCount} columns`;
    }
  }, [hiddenCount, totalCount]);

  return (
    <Menu>
      <Menu.Target>
        <ButtonSecondaryInline rightSection={<ChevronDownIcon size={16} />}>{buttonText}</ButtonSecondaryInline>
      </Menu.Target>
      <Menu.Dropdown>
        {table.tableSpec.columns.map((column) => {
          const isHidden = table.hiddenColumns.includes(column.id.wsId);
          return (
            <Menu.Item
              key={column.id.wsId}
              onClick={() => (isHidden ? unhideColumn(table.id, column.id.wsId) : hideColumn(table.id, column.id.wsId))}
              leftSection={getColumnTypeIcon(column.pgType)}
              rightSection={!isHidden && <CheckIcon size={16} />}
            >
              {column.name}
            </Menu.Item>
          );
        })}
        <Menu.Divider />
        <Menu.Item disabled={hiddenCount === 0} onClick={() => showAllColumns(table.id)}>
          Show all columns
        </Menu.Item>
        <Menu.Item disabled={hiddenCount === totalCount} onClick={() => hideAllColumns()}>
          Hide all columns
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
