import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Tooltip } from '@mantine/core';
import { CloudDownloadIcon, RefreshCwIcon } from 'lucide-react';
import { serviceName } from '../../../../../../../service-naming-conventions';
import { useWorkbookEditorUIStore, WorkbookModals } from '../../../../../../../stores/workbook-editor-store';
import { formatDate, timeAgo } from '../../../../../../../utils/helpers';

export const LastUpdatedFooterButton = ({ table }: { table: SnapshotTable }) => {
  const showModal = useWorkbookEditorUIStore((state) => state.showModal);

  if (!table.lastSyncTime) {
    return null;
  }
  const tooltipLabel = `Records were last synced ${
    table.connectorService ? `from ${serviceName(table.connectorService)}` : ''
  } on ${formatDate(table.lastSyncTime)}.`;

  return (
    <Tooltip label={tooltipLabel}>
      <ButtonSecondaryInline
        leftSection={<CloudDownloadIcon size={16} />}
        rightSection={<RefreshCwIcon size={16} />}
        onClick={() => showModal({ type: WorkbookModals.CONFIRM_REFRESH_SOURCE })}
      >
        {timeAgo(table.lastSyncTime)}
      </ButtonSecondaryInline>
    </Tooltip>
  );
};
