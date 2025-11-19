import { Button, Modal, Stack, Text } from '@mantine/core';
import { FC } from 'react';
import { useJobWithCancellation } from '../../../../hooks/use-progress';
import { PublishRecordsPublicProgress } from './PublishJobProgress';
import { PublishJobProgressDisplay } from './PublishJobProgressDisplay';

type Props = {
  jobId: string;
  onClose: () => void;
};

export const PublishJobProgressModal: FC<Props> = (props) => {
  const { jobId, onClose } = props;
  const { jobResult, cancellationRequested, isCancelling, cancelJob } =
    useJobWithCancellation<PublishRecordsPublicProgress>(jobId);
  const { job, error, isLoading } = jobResult;

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (error) return 'Error loading progress';
    if (!job) return 'Waiting for job to start...';

    // Show cancellation status
    if (cancellationRequested && job.state === 'active') {
      return 'Cancelling job...';
    }

    switch (job.state) {
      case 'waiting':
        return 'Job is waiting to start...';
      case 'active':
        return 'Publishing data...';
      case 'completed':
        return 'Publish completed successfully!';
      case 'failed':
        return `Publish failed: ${job.failedReason || 'Unknown error'}`;
      case 'delayed':
        return 'Job is delayed...';
      case 'paused':
        return 'Job is paused...';
      default:
        return 'Processing...';
    }
  };

  // const getPublishProgress = (): PublishRecordsPublicProgress | null => {
  //   if (!job?.publicProgress || typeof job.publicProgress !== 'object') {
  //     return null;
  //   }
  //   return job.publicProgress as PublishRecordsPublicProgress;
  // };

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={<Text>{getStatusText()}</Text>}
      centered
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={job?.state === 'completed' || job?.state === 'failed'}
    >
      <Stack mih={200}>
        {job?.publicProgress ? (
          <PublishJobProgressDisplay publishProgress={job.publicProgress} />
        ) : job?.state === 'active' ? (
          <Text>Loading...</Text>
        ) : null}

        {/* Cancel button - show when job is active and not already cancelled */}
        {job?.state === 'active' && !cancellationRequested && (
          <Button onClick={cancelJob} loading={isCancelling} color="red" variant="outline" fullWidth>
            {isCancelling ? 'Cancelling...' : 'Cancel Publish'}
          </Button>
        )}

        {/* Close button - show when job is completed or failed */}
        {(job?.state === 'completed' || job?.state === 'failed') && (
          <Button onClick={onClose} fullWidth>
            Close
          </Button>
        )}
      </Stack>
    </Modal>
  );
};
