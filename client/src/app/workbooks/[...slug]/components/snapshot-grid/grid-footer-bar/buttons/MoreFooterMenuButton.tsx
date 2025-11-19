import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { EllipsisVerticalIcon } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const MoreFooterMenuButton = ({ table }: { table: SnapshotTable }) => {
  return (
    <ButtonSecondaryInline>
      <EllipsisVerticalIcon size={16} />
    </ButtonSecondaryInline>
  );
};
