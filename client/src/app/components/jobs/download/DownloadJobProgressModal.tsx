import { Button, Modal, Stack, Text } from '@mantine/core';
import { FC } from 'react';
import { useJobWithCancellation } from '../../../../hooks/use-progress';
import { DownloadProgress } from './DownloadJobProgress';
import { DownloadJobProgressDisplay } from './DownloadJobProgressDisplay';

type Props = {
  jobId: string;
  onClose: () => void;
};

export const DownloadProgressModal: FC<Props> = (props) => {
  const { jobId, onClose } = props;
  const { jobResult, cancellationRequested, isCancelling, cancelJob } = useJobWithCancellation<DownloadProgress>(jobId);
  const { job, error, isLoading } = jobResult;

  // // Close modal when job is completed or failed
  // useEffect(() => {
  //   if (job?.state === 'completed' || job?.state === 'failed') {
  //     // Auto-close after a short delay to show final state
  //     const timer = setTimeout(() => {
  //       onClose();
  //     }, 2000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [job?.state, onClose]);

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
        return 'Downloading data...';
      case 'completed':
        return 'Download completed successfully!';
      case 'failed':
        return `Download failed: ${job.failedReason || 'Unknown error'}`;
      case 'delayed':
        return 'Job is delayed...';
      case 'paused':
        return 'Job is paused...';
      default:
        return 'Processing...';
    }
  };

  // const getStatusColor = () => {
  //   if (error || progress?.state === 'failed') return 'red';
  //   if (progress?.state === 'completed') return 'green';
  //   if (cancellationRequested && progress?.state === 'active') return 'orange';
  //   if (progress?.state === 'active') return 'blue';
  //   return 'orange';
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
      <Stack>
        <DownloadJobProgressDisplay job={job} />

        {/* Cancel button - show when job is active and not already cancelled */}
        {job?.state === 'active' && !cancellationRequested && (
          <Button onClick={cancelJob} loading={isCancelling} color="red" variant="outline" fullWidth>
            {isCancelling ? 'Cancelling...' : 'Cancel Download'}
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
