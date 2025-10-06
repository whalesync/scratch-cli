import { JobEntity } from '@/types/server-entities/job';
import { Modal, Stack, Text } from '@mantine/core';
import { FC } from 'react';
import { DownloadProgress } from './DownloadJobProgress';
import { DownloadJobProgressDisplay } from './DownloadJobProgressDisplay';

type Props = {
  job: JobEntity;
  onClose: () => void;
};

export const DownloadProgressModal2: FC<Props> = (props) => {
  const { job, onClose } = props;

  // Get download progress from the job's publicProgress
  const getDownloadProgress = (): DownloadProgress | null => {
    if (!job.publicProgress || typeof job.publicProgress !== 'object') {
      return null;
    }
    return job.publicProgress as DownloadProgress;
  };

  const downloadProgress = getDownloadProgress();

  return (
    <Modal opened={true} onClose={onClose} title={<Text>Job Progress</Text>} centered size="lg">
      <Stack>
        {downloadProgress ? (
          <DownloadJobProgressDisplay downloadProgress={downloadProgress} />
        ) : (
          <Text>No progress data available for this job.</Text>
        )}
      </Stack>
    </Modal>
  );
};
