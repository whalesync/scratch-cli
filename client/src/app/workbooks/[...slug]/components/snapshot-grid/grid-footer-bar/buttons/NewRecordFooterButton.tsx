import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { SnapshotTable } from '@spinner/shared-types';
import { PlusIcon } from 'lucide-react';
import { ButtonSecondaryInline } from '../../../../../../components/base/buttons';

export const NewRecordFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { createNewRecord } = useSnapshotTableRecords({
    workbookId: table.workbookId,
    tableId: table.id,
  });

  return (
    <ButtonSecondaryInline leftSection={<PlusIcon size={13} />} onClick={createNewRecord}>
      Row
    </ButtonSecondaryInline>
  );
};
