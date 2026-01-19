import { DownloadProgress, isDownloadFilesProgress } from '@/app/components/jobs/download/DownloadJobProgress';
import { getTerminalTableStatus } from '@/app/components/jobs/job-utils';
import { TableStatus } from '@/app/components/jobs/publish/PublishJobProgress';
import { SyncStatus } from '@/app/components/jobs/SyncStatus/sync-status';
import { getServiceName } from '@/service-naming-conventions';
import { JobEntity } from '@/types/server-entities/job';
import { Alert, Stack } from '@mantine/core';
import { Service } from '@spinner/shared-types';
import { AlertCircle } from 'lucide-react';
import { FC } from 'react';

type Props = {
  job?: JobEntity<DownloadProgress>;
};

export const DownloadJobProgressDisplay: FC<Props> = (props) => {
  const { job } = props;

  if (!job || !job.publicProgress) {
    return null;
  }

  const { publicProgress, state, failedReason } = job;

  // Handle download files progress (folders)
  if (isDownloadFilesProgress(publicProgress)) {
    return (
      <Stack gap="xl">
        {publicProgress.folders.map((folder) => (
          <Stack key={folder.id} gap="md">
            <SyncStatus
              tableName={folder.name}
              connector={folder.connector}
              doneCount={folder.files}
              status={getTerminalTableStatus(folder.status as TableStatus, state)}
              direction="left"
            />

            {folder.hasDirtyDiscoveredDeletes && (
              <Alert icon={<AlertCircle size={16} />} color="yellow" p="xs">
                Files with unpublished scratch changes were deleted from {getServiceName(folder.connector as Service)}
              </Alert>
            )}
          </Stack>
        ))}
        {failedReason && (
          <Alert icon={<AlertCircle size={16} />} title="Download Failed" color="red" mt="md">
            {failedReason}
          </Alert>
        )}
      </Stack>
    );
  }

  // Handle download records progress (tables) - original behavior
  return (
    <Stack gap="xl">
      {publicProgress.tables.map((table) => (
        <Stack key={table.id} gap="md">
          <SyncStatus
            tableName={table.name}
            connector={table.connector}
            doneCount={table.records}
            status={getTerminalTableStatus(table.status as TableStatus, state)}
            direction="left"
          />

          {table.hasDirtyDiscoveredDeletes && (
            <Alert icon={<AlertCircle size={16} />} color="yellow" p="xs">
              Records with unpublished scratch changes were deleted from {getServiceName(table.connector as Service)}
            </Alert>
          )}
        </Stack>
      ))}
      {failedReason && (
        <Alert icon={<AlertCircle size={16} />} title="Download Failed" color="red" mt="md">
          {failedReason}
        </Alert>
      )}
    </Stack>
  );
};
