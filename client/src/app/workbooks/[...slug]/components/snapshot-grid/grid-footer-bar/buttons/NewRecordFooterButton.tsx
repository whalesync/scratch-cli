import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { PlusIcon } from '@phosphor-icons/react';
import { ButtonSecondaryInline } from '../../../../../../components/base/buttons';

export const NewRecordFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { createNewRecord } = useSnapshotTableRecords({
    workbookId: table.workbookId,
    tableId: table.id,
  });

  return (
    <ButtonSecondaryInline leftSection={<PlusIcon size={16} />} onClick={createNewRecord}>
      Row
    </ButtonSecondaryInline>
  );
};
