import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Button, Code, Group, Modal, Stack, Text } from '@mantine/core';
import { PartyPopper } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';
import { useJobWithCancellation } from '../../../../hooks/use-progress';
import { ButtonSecondaryOutline } from '../../base/buttons';
import { Text16Medium } from '../../base/text';
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
  const { isStepPending } = useOnboarding();
  const { completeFlow } = useOnboardingUpdate();
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  // Persist the initial onboarding state so it doesn't change during the modal lifecycle
  const wasPublishStepPendingRef = useRef<boolean | null>(null);
  if (wasPublishStepPendingRef.current === null) {
    wasPublishStepPendingRef.current = isStepPending('gettingStartedV1', 'dataPublished');
  }

  // Show congratulations when job completes and user had the publish step pending
  const showCongratulations = job?.state === 'completed' && wasPublishStepPendingRef.current;

  // Optimistically complete the flow when job completes and user had the publish step pending
  useEffect(() => {
    if (job?.state === 'completed' && wasPublishStepPendingRef.current) {
      completeFlow('gettingStartedV1');
    }
  }, [job?.state, completeFlow]);
  const buttons = (
    <>
      {/* Cancel button - show when job is active and not already cancelled */}
      {job?.state === 'active' && !cancellationRequested && (
        <ButtonSecondaryOutline onClick={cancelJob} loading={isCancelling} color="red" variant="outline">
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </ButtonSecondaryOutline>
      )}

      {/* Close button - show when job is completed or failed */}
      {(job?.state === 'completed' || job?.state === 'failed') && (
        <ButtonSecondaryOutline onClick={onClose}>Close</ButtonSecondaryOutline>
      )}
      {/* Close button - show when job is active */}
      {job?.state === 'active' && <ButtonSecondaryOutline disabled={true}>Publishing...</ButtonSecondaryOutline>}
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
        {showCongratulations && (
          <Group gap="xs" align="center" justify="center">
            <PartyPopper size={20} color="var(--mantine-color-yellow-5)" />
            <Text16Medium>Congratulations! You published your first changes.</Text16Medium>
          </Group>
        )}
        <PublishJobProgressDisplay job={job} />
      </Stack>
    </ModalWrapper>
  );
};
