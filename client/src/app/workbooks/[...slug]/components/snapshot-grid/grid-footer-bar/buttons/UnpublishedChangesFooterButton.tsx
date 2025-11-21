import { SnapshotTable } from '@/types/server-entities/workbook';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useSnapshotTableRecords } from '../../../../../../../hooks/use-snapshot-table-records';
import { Text13Regular } from '../../../../../../components/base/text';

export const UnpublishedChangesFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { records } = useSnapshotTableRecords({
    workbookId: table.workbookId,
    tableId: table.id,
  });

  // TODO: Get this from the server so it includes records that are filtered out too.
  const unpublishedCount = useMemo(() => {
    if (!records) return 0;
    return records.reduce((count, record) => {
      if (record.__edited_fields) {
        for (const _key in record.__edited_fields) {
          return count + 1; // Found at least one key
        }
      }
      return count;
    }, 0);
  }, [records]);

  // TODO: Open the publication modal from here too?
  return (
    <Text13Regular>
      {unpublishedCount} unpublished {pluralize('change', unpublishedCount)}
    </Text13Regular>
  );
};
