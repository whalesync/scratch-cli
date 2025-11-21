import { SnapshotTable } from '@/types/server-entities/workbook';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useOperationCounts } from '../../../../../../../hooks/use-operation-counts';
import { Text13Regular } from '../../../../../../components/base/text';

export const UnpublishedChangesFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { operationCounts } = useOperationCounts(table.workbookId);

  const unpublishedCount = useMemo(() => {
    const oc = operationCounts?.find((count) => count.tableId === table.id);
    if (!oc) {
      console.log('no operation counts found for table', table.id, operationCounts);
      return null;
    }
    return oc.creates + oc.updates + oc.deletes;
  }, [operationCounts, table.id]);

  // TODO: Open the publication modal from here too?
  return (
    <Text13Regular>
      {unpublishedCount ?? '-'} unpublished {pluralize('change', unpublishedCount ?? 0)}
    </Text13Regular>
  );
};
