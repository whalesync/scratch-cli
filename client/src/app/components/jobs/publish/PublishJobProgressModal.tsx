import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useWorkbooks } from '@/hooks/use-workbooks';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { Button, Code, Group, Modal, Stack, Text } from '@mantine/core';
import { ArrowUpRightIcon, CheckIcon, PlusIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useJobWithCancellation } from '../../../../hooks/use-progress';
import { RouteUrls } from '../../../../utils/route-urls';
import { ScratchpadNotifications } from '../../../components/ScratchpadNotifications';
import { ButtonSecondaryOutline, ButtonWithDescription } from '../../base/buttons';
import { Text13Book, TextMono12Regular, TextTitle1 } from '../../base/text';
import { DecorativeBoxedIcon } from '../../Icons/DecorativeBoxedIcon';
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
  const { createWorkbook } = useWorkbooks();
  const router = useRouter();
  const [debugModalOpen, setDebugModalOpen] = useState(false);
  const [isCreatingWorkbook, setIsCreatingWorkbook] = useState(false);

  const handleCreateWorkbook = useCallback(async () => {
    setIsCreatingWorkbook(true);
    try {
      const newWorkbook = await createWorkbook({});
      router.push(RouteUrls.workbookPageUrl(newWorkbook.id));
    } catch (error) {
      ScratchpadNotifications.error({
        title: 'Error creating workbook',
        message: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    } finally {
      setIsCreatingWorkbook(false);
    }
  }, [createWorkbook, router]);

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
      // size="lg"
      onClose={onClose}
      title={
        showCongratulations ? (
          <DecorativeBoxedIcon Icon={CheckIcon}></DecorativeBoxedIcon>
        ) : (
          <Group>
            <Text>Publish changes</Text>
            {isAdmin && (
              <Button variant="subtle" size="xs" onClick={() => setDebugModalOpen(true)}>
                Debug
              </Button>
            )}
          </Group>
        )
      }
      closeOnClickOutside={false}
      closeOnEscape={job?.state === 'completed' || job?.state === 'failed'}
    >
      {showCongratulations ? (
        <Stack gap="lg">
          <Stack gap="md">
            <TextTitle1>You’re all set!</TextTitle1>
            <Text13Book c="var(--fg-muted)">
              Congratulations, you published your first changes with Scratch.{' '}
            </Text13Book>
          </Stack>
          <Stack gap="sm">
            <TextMono12Regular>Next Steps!</TextMono12Regular>
            <ButtonWithDescription
              title="Create new workbook"
              description="Edit the content from your own data sources."
              icon={<StyledLucideIcon Icon={PlusIcon} size="md" c={'dimmed'} />}
              onClick={handleCreateWorkbook}
              disabled={isCreatingWorkbook}
            />
            <ButtonWithDescription
              title="Get the most out of Scratch"
              description="Learn"
              icon={<StyledLucideIcon Icon={ArrowUpRightIcon} size="md" c={'dimmed'} />}
              onClick={() => window.open('https://docs.scratch.md/', '_blank')}
            />
          </Stack>
        </Stack>
      ) : (
        <Stack mih={150}>
          <Modal opened={debugModalOpen} onClose={() => setDebugModalOpen(false)} title="Progress Debug" size="xl">
            <Code block>{JSON.stringify(job?.publicProgress, null, 2)}</Code>
          </Modal>

          <PublishJobProgressDisplay job={job} />
        </Stack>
      )}
    </ModalWrapper>
  );
};
