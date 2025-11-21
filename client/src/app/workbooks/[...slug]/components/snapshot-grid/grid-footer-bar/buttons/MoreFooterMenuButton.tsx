import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Menu } from '@mantine/core';
import { EllipsisVerticalIcon } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const MoreFooterMenuButton = ({ table }: { table: SnapshotTable }) => {
  return (
    <Menu>
      <Menu.Target>
        <ButtonSecondaryInline>
          <EllipsisVerticalIcon size={16} />
        </ButtonSecondaryInline>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item>Accept all suggestions</Menu.Item>
      </Menu.Dropdown>
      <Menu.Dropdown>
        <Menu.Item>Reject all suggestions</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
