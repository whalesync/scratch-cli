import { SnapshotTable } from '@spinner/shared-types';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useOperationCounts } from '../../../../../../../hooks/use-operation-counts';
import { useWorkbookEditorUIStore } from '../../../../../../../stores/workbook-editor-store';
import { ButtonSecondaryInline } from '../../../../../../components/base/buttons';

export const UnpublishedChangesFooterButton = ({ table }: { table: SnapshotTable }) => {
  const workbookMode = useWorkbookEditorUIStore((state) => state.workbookMode);
  const { operationCounts } = useOperationCounts(table.workbookId, workbookMode);
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);

  const unpublishedCount = useMemo(() => {
    const oc = operationCounts?.find((count) => count.tableId === table.id);
    if (!oc) {
      console.log('no operation counts found for table', table.id, operationCounts);
      return null;
    }
    return oc.creates + oc.updates + oc.deletes;
  }, [operationCounts, table.id]);

  return (
    <ButtonSecondaryInline onClick={openPublishConfirmation}>
      {unpublishedCount ?? '-'} unpublished {pluralize('change', unpublishedCount ?? 0)}
    </ButtonSecondaryInline>
  );
};
