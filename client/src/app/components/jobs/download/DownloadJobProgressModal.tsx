import { Button, Modal, Stack, Text } from '@mantine/core';
import { FC, useEffect } from 'react';
import { useJobProgressWithCancellation } from '../../../../hooks/use-progress';
import { DownloadProgress } from './DownloadJobProgress';
import { DownloadJobProgressDisplay } from './DownloadJobProgressDisplay';

type Props = {
  jobId: string;
  onClose: () => void;
};

export const DownloadProgressModal: FC<Props> = (props) => {
  const { jobId, onClose } = props;
  const { progress, error, isLoading, cancellationRequested, isCancelling, cancelJob } =
    useJobProgressWithCancellation(jobId);

  // Close modal when job is completed or failed
  useEffect(() => {
    if (progress?.state === 'completed' || progress?.state === 'failed') {
      // Auto-close after a short delay to show final state
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [progress?.state, onClose]);

  const getStatusText = () => {
    if (isLoading) return 'Loading...';
    if (error) return 'Error loading progress';
    if (!progress) return 'Waiting for job to start...';

    // Show cancellation status
    if (cancellationRequested && progress.state === 'active') {
      return 'Cancelling job...';
    }

    switch (progress.state) {
      case 'waiting':
        return 'Job is waiting to start...';
      case 'active':
        return 'Downloading data...';
      case 'completed':
        return 'Download completed successfully!';
      case 'failed':
        return `Download failed: ${progress.failedReason || 'Unknown error'}`;
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

  const getDownloadProgress = (): DownloadProgress | null => {
    if (!progress?.publicProgress || typeof progress.publicProgress !== 'object') {
      return null;
    }
    return progress.publicProgress as DownloadProgress;
  };

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={<Text>{getStatusText()}</Text>}
      centered
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={progress?.state === 'completed' || progress?.state === 'failed'}
    >
      <Stack>
        {progress ? (
          <Stack gap="md">
            {(() => {
              const downloadProgress = getDownloadProgress();
              if (!downloadProgress) {
                return <Text>Loading progress...</Text>;
              }

              return <DownloadJobProgressDisplay downloadProgress={downloadProgress} />;
            })()}
          </Stack>
        ) : (
          <Text>Loading...</Text>
        )}

        {/* Cancel button - show when job is active and not already cancelled */}
        {progress?.state === 'active' && !cancellationRequested && (
          <Button onClick={cancelJob} loading={isCancelling} color="red" variant="outline" fullWidth>
            {isCancelling ? 'Cancelling...' : 'Cancel Download'}
          </Button>
        )}

        {/* Close button - show when job is completed or failed */}
        {(progress?.state === 'completed' || progress?.state === 'failed') && (
          <Button onClick={onClose} fullWidth>
            Close
          </Button>
        )}
      </Stack>
    </Modal>
  );
};
