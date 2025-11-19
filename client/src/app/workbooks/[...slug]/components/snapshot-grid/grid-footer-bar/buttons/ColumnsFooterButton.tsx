import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ColumnsFooterButton = ({ table }: { table: SnapshotTable }) => {
  return <ButtonSecondaryInline>All columns</ButtonSecondaryInline>;
};
