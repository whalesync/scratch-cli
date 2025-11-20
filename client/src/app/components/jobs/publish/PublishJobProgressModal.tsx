import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Button, Code, Group, Modal, Stack, Text } from '@mantine/core';
import { FC, useState } from 'react';
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
  const { job } = jobResult;
  const { isAdmin } = useScratchPadUser();
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={
        <Group>
          <Text>Publish changes</Text>
          {isAdmin && (
            <Button variant="subtle" size="xs" onClick={() => setDebugModalOpen(true)}>
              Debug
            </Button>
          )}
        </Group>
      }
      centered
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape={job?.state === 'completed' || job?.state === 'failed'}
    >
      <Stack mih={200}>
        <Modal opened={debugModalOpen} onClose={() => setDebugModalOpen(false)} title="Progress Debug" size="xl">
          <Code block>{JSON.stringify(job?.publicProgress, null, 2)}</Code>
        </Modal>
        <PublishJobProgressDisplay job={job} />

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
