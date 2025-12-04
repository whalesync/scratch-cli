import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Button, Code, Group, Modal, Stack, Text } from '@mantine/core';
import { FC, useState } from 'react';
import { useJobWithCancellation } from '../../../../hooks/use-progress';
import { ButtonSecondaryOutline } from '../../base/buttons';
import { ModalWrapper } from '../../ModalWrapper';
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
  const buttons = (
    <>
      {/* Cancel button - show when job is active and not already cancelled */}
      {job?.state === 'active' && !cancellationRequested && (
        <ButtonSecondaryOutline onClick={cancelJob} loading={isCancelling} color="red" variant="outline">
          {isCancelling ? 'Cancelling...' : 'Cancel Publish'}
        </ButtonSecondaryOutline>
      )}

      {/* Close button - show when job is completed or failed */}
      {(job?.state === 'completed' || job?.state === 'failed') && (
        <ButtonSecondaryOutline onClick={onClose}>Close</ButtonSecondaryOutline>
      )}
      {/* Close button - show when job is active */}
      {job?.state === 'active' && <ButtonSecondaryOutline onClick={onClose}>Publishing...</ButtonSecondaryOutline>}
    </>
  );
  return (
    <ModalWrapper
      customProps={{ footer: buttons }}
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
      closeOnClickOutside={false}
      closeOnEscape={job?.state === 'completed' || job?.state === 'failed'}
    >
      <Stack mih={150}>
        <Modal opened={debugModalOpen} onClose={() => setDebugModalOpen(false)} title="Progress Debug" size="xl">
          <Code block>{JSON.stringify(job?.publicProgress, null, 2)}</Code>
        </Modal>
        <PublishJobProgressDisplay job={job} />
      </Stack>
    </ModalWrapper>
  );
};
