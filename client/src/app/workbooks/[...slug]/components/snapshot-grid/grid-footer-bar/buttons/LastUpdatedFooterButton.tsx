import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Tooltip } from '@mantine/core';
import { CloudDownloadIcon, RefreshCwIcon } from 'lucide-react';
import { serviceName } from '../../../../../../../service-naming-conventions';
import { formatDate, timeAgo } from '../../../../../../../utils/helpers';

export const LastUpdatedFooterButton = ({ table }: { table: SnapshotTable }) => {
  if (!table.lastSyncTime) {
    return null;
  }
  const tooltipLabel = `Records were last synced ${
    table.connectorService ? `from ${serviceName(table.connectorService)}` : ''
  } on ${formatDate(table.lastSyncTime)}.`;
  // TODO: This should trigger the re-sync operation once the modals are moved up a level.
  return (
    <Tooltip label={tooltipLabel}>
      <ButtonSecondaryInline leftSection={<CloudDownloadIcon size={16} />} rightSection={<RefreshCwIcon size={16} />}>
        {timeAgo(table.lastSyncTime)}
      </ButtonSecondaryInline>
    </Tooltip>
  );
};
