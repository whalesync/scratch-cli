import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { DeletedConnectionIcon } from '@/app/components/DeletedConnectionIcon';
import { serviceName } from '@/service-naming-conventions';
import { useWorkbookEditorUIStore, WorkbookModals } from '@/stores/workbook-editor-store';
import { hasDeletedConnection, SnapshotTable } from '@/types/server-entities/workbook';
import { formatDate, timeAgo } from '@/utils/helpers';
import { Loader, Tooltip } from '@mantine/core';
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
            <DeletedConnectionIcon decorative={false} tooltipEnabled={false} />
          ) : table.lock === 'download' ? (
            <Loader size={14} color="gray" />
          ) : (
            <CloudDownloadIcon size={16} />
          )
        }
        rightSection={isConnectionDeleted || table.lock === 'download' ? <></> : <RefreshCwIcon size={16} />}
        disabled={isConnectionDeleted || !!table.lock}
        onClick={() => showModal({ type: WorkbookModals.CONFIRM_REFRESH_SOURCE })}
      >
        {
          table.lock === 'download'
            ? 'Downloading'
            : table.lastSyncTime
              ? timeAgo(table.lastSyncTime)
              : 'Refresh data' /* lastSyncTime is null on old workbooks or if it's never been downloaded */
        }
      </ButtonSecondaryInline>
    </Tooltip>
  );
};
