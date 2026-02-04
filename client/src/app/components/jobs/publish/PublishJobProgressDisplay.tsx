import { PublishRecordsPublicProgress, TableStatus } from '@/app/components/jobs/publish/PublishJobProgress';
import { JobEntity } from '@/types/server-entities/job';
import { Alert, Stack } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import { FC } from 'react';
import { SyncStatus } from '../SyncStatus/sync-status';
import { getTerminalTableStatus } from '../job-utils';

// Data folder publish job progress structure (new multi-folder format)
type FolderPublishProgress = {
  id: string;
  name: string;
  connector: string;
  creates: number;
  updates: number;
  deletes: number;
  expectedCreates: number;
  expectedUpdates: number;
  expectedDeletes: number;
  status: TableStatus;
};

type PublishDataFolderPublicProgress = {
  totalFilesPublished: number;
  folders: FolderPublishProgress[];
};

type PublishProgress = PublishRecordsPublicProgress | PublishDataFolderPublicProgress;

type Props = {
  job?: JobEntity<PublishProgress>;
};

// Type guard to check if progress is for data folder publish (has folders array)
function isDataFolderProgress(progress: PublishProgress): progress is PublishDataFolderPublicProgress {
  return 'folders' in progress && Array.isArray(progress.folders);
}

export const PublishJobProgressDisplay: FC<Props> = (props) => {
  const { job } = props;

  if (!job || !job.publicProgress) {
    return null;
  }
  const { publicProgress, state, failedReason } = job;

  // Handle data folder publish progress (folders array)
  if (isDataFolderProgress(publicProgress)) {
    return (
      <Stack gap="lg">
        {publicProgress.folders.map((folder) => (
          <SyncStatus
            key={folder.id}
            tableName={folder.name}
            connector={folder.connector}
            doneCount={folder.creates + folder.updates + folder.deletes}
            totalCount={folder.expectedCreates + folder.expectedUpdates + folder.expectedDeletes}
            status={getTerminalTableStatus(folder.status, state)}
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
  }

  // Handle table publish progress (has tables array - legacy format)
  return (
    <Stack gap="lg">
      {publicProgress.tables?.map((table) => (
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
