import { Stack, Text } from '@mantine/core';
import { FC } from 'react';
import { useJobWithCancellation } from '../../../../hooks/use-progress';
import { ButtonSecondaryOutline } from '../../base/buttons';
import { ModalWrapper } from '../../ModalWrapper';
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
        return 'Fetching data...';
      case 'completed':
        return 'Refresh completed successfully!';
      case 'failed':
        return `Refresh failed: ${job.failedReason || 'Unknown error'}`;
      case 'delayed':
        return 'Job is delayed...';
      case 'paused':
        return 'Job is paused...';
      default:
        return 'Processing...';
    }
  };

  const buttons = (
    <>
      {/* Cancel button - show when job is active and not already cancelled */}
      {job?.state === 'active' && !cancellationRequested && (
        <ButtonSecondaryOutline onClick={cancelJob} loading={isCancelling} color="red" variant="outline">
          {isCancelling ? 'Cancelling...' : 'Cancel Download'}
        </ButtonSecondaryOutline>
      )}

      {/* Close button - show when job is completed or failed */}
      {(job?.state === 'completed' || job?.state === 'failed') && (
        <ButtonSecondaryOutline onClick={onClose}>Close</ButtonSecondaryOutline>
      )}
    </>
  );

  return (
    <ModalWrapper
      customProps={{ footer: buttons }}
      opened={true}
      onClose={onClose}
      title={<Text>{getStatusText()}</Text>}
      closeOnClickOutside={false}
      closeOnEscape={job?.state === 'completed' || job?.state === 'failed'}
    >
      <Stack>
        <DownloadJobProgressDisplay job={job} />
      </Stack>
    </ModalWrapper>
  );
};
