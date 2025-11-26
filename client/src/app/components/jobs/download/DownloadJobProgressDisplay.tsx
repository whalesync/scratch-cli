import { DownloadProgress } from '@/app/components/jobs/download/DownloadJobProgress';
import { SyncStatus } from '@/app/components/jobs/SyncStatus/sync-status';
import { getTerminalTableStatus } from '@/app/components/jobs/job-utils';
import { TableStatus } from '@/app/components/jobs/publish/PublishJobProgress';
import { JobEntity } from '@/types/server-entities/job';
import { Alert, Stack } from '@mantine/core';
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

  return (
    <Stack gap="sm">
      {/* Tables List */}
      <Stack gap="xs">
        {publicProgress.tables.map((table) => (
          <Stack key={table.id} gap="lg">
            <SyncStatus
              tableName={table.name}
              connector={table.connector}
              doneCount={table.records}
              status={getTerminalTableStatus(table.status as TableStatus, state)}
              direction="left"
            />
          </Stack>
        ))}
      </Stack>

      {failedReason && (
        <Alert icon={<AlertCircle size={16} />} title="Download Failed" color="red" mt="md">
          {failedReason}
        </Alert>
      )}
    </Stack>
  );
};
