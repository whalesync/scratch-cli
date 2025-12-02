import { PublishRecordsPublicProgress } from '@/app/components/jobs/publish/PublishJobProgress';
import { JobEntity } from '@/types/server-entities/job';
import { Alert, Stack } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import { FC } from 'react';
import { SyncStatus } from '../SyncStatus/sync-status';
import { getTerminalTableStatus } from '../job-utils';

type Props = {
  job?: JobEntity<PublishRecordsPublicProgress>;
};

export const PublishJobProgressDisplay: FC<Props> = (props) => {
  const { job } = props;

  if (!job || !job.publicProgress) {
    return null;
  }
  const { publicProgress, state, failedReason } = job;
  return (
    <Stack gap="lg">
      {publicProgress.tables.map((table) => (
        <SyncStatus
          key={table.id}
          tableName={table.name}
          connector={table.connector}
          doneCount={table.creates + table.updates + table.deletes}
          totalCount={table.expectedCreates + table.expectedUpdates + table.expectedDeletes}
          status={getTerminalTableStatus(table.status, state)}
          direction="right"
        />
      ))}

      {failedReason && (
        <Alert icon={<AlertCircle size={16} />} title="Publish Failed" color="red" mt="md">
          {failedReason}
        </Alert>
      )}
    </Stack>
  );
};
