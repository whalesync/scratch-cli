import { Badge, Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { Check, Circle, Dot } from 'lucide-react';
import { FC, useEffect } from 'react';
import { useJobProgressWithCancellation } from '../../../../../../hooks/use-progress';

type Props = {
  snapshotId: string;
  jobId: string;
  onClose: () => void;
};

type TableProgress = {
  id: string;
  name: string;
  records: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
};

type DownloadProgress = {
  totalRecords: number;
  tables: TableProgress[];
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

  const getStatusColor = () => {
    if (error || progress?.state === 'failed') return 'red';
    if (progress?.state === 'completed') return 'green';
    if (cancellationRequested && progress?.state === 'active') return 'orange';
    if (progress?.state === 'active') return 'blue';
    return 'orange';
  };

  const getDownloadProgress = (): DownloadProgress | null => {
    if (!progress?.publicProgress || typeof progress.publicProgress !== 'object') {
      return null;
    }
    return progress.publicProgress as DownloadProgress;
  };

  const getTableIndicator = (status: TableProgress['status']) => {
    switch (status) {
      case 'pending':
        return (
          <ThemeIcon size="sm" variant="outline" color="gray">
            <Circle size={12} />
          </ThemeIcon>
        );
      case 'active':
        return (
          <ThemeIcon size="sm" color="blue">
            <Dot size={12} />
          </ThemeIcon>
        );
      case 'completed':
        return (
          <ThemeIcon size="sm" color="green">
            <Check size={12} />
          </ThemeIcon>
        );
      case 'failed':
        return (
          <ThemeIcon size="sm" color="red">
            <Circle size={12} />
          </ThemeIcon>
        );
      default:
        return (
          <ThemeIcon size="sm" variant="outline" color="gray">
            <Circle size={12} />
          </ThemeIcon>
        );
    }
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

              return (
                <Stack gap="sm">
                  {/* Total Records */}
                  <Group justify="space-between">
                    <Text fw={500}>Total Records Downloaded</Text>
                    <Badge size="lg" color={getStatusColor()}>
                      {downloadProgress.totalRecords.toLocaleString()}
                    </Badge>
                  </Group>

                  {/* Tables List */}
                  <Stack gap="xs">
                    <Text fw={500} size="sm">
                      Tables Progress
                    </Text>
                    {downloadProgress.tables.map((table) => (
                      <Group
                        key={table.id}
                        justify="space-between"
                        p="xs"
                        // style={{
                        //   backgroundColor: 'var(--mantine-color-gray-0)',
                        //   borderRadius: 'var(--mantine-radius-sm)',
                        // }}
                      >
                        <Group gap="sm">
                          {getTableIndicator(table.status)}
                          <Text size="sm" fw={500}>
                            {table.name}
                          </Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {table.records.toLocaleString()} records
                        </Text>
                      </Group>
                    ))}
                  </Stack>
                </Stack>
              );
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
