import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { DeletedConnectionIcon } from '@/app/components/DeletedConnectionIcon';
import { serviceName } from '@/service-naming-conventions';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { hasDeletedConnection, SnapshotTable } from '@/types/server-entities/workbook';
import { formatDate, timeAgo } from '@/utils/helpers';
import { Tooltip } from '@mantine/core';
import { CloudDownloadIcon, RefreshCwIcon } from 'lucide-react';

export const LastUpdatedFooterButton = ({ table }: { table: SnapshotTable }) => {
  const showModal = useWorkbookEditorUIStore((state) => state.showModal);
  const isConnectionDeleted = hasDeletedConnection(table);

  const tooltipLabel = `Records were last synced ${
    table.connectorService ? `from ${serviceName(table.connectorService)}` : ''
  } on ${table.lastSyncTime ? formatDate(table.lastSyncTime) : '??'}.`;

  return (
    <Tooltip label={isConnectionDeleted ? 'Connection deleted' : tooltipLabel}>
      <ButtonSecondaryInline
        leftSection={
          isConnectionDeleted ? (
            <DeletedConnectionIcon size={16} tooltipEnabled={false} />
          ) : (
            <CloudDownloadIcon size={16} />
          )
        }
        rightSection={isConnectionDeleted ? <></> : <RefreshCwIcon size={16} />}
        disabled={isConnectionDeleted}
        onClick={() => showModal({ type: WorkbookModals.CONFIRM_REFRESH_SOURCE })}
      >
        {
          table.lastSyncTime
            ? timeAgo(table.lastSyncTime)
            : 'Refresh data' /* lastSyncTime is null on old workbooks or if it's never been downloaded */
        }
      </ButtonSecondaryInline>
    </Tooltip>
  );
};
