'use client';

import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { bugReportApi } from '@/lib/api/bug-report';
import { getSessionId, getSessionReplayUrl } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { isExperimentEnabled } from '@/types/server-entities/users';
import { Alert, Anchor, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '../base/buttons';
import { Text13Book } from '../base/text';
import { ModalWrapper } from '../ModalWrapper';
import { ScratchpadNotifications } from '../ScratchpadNotifications';

export function ReportABugModal() {
  const { user } = useScratchPadUser();
  const reportABugModalOpened = useLayoutManagerStore((state) => state.reportABugModalOpened);
  const closeReportABugModal = useLayoutManagerStore((state) => state.closeReportABugModal);

  const { workbook, activeTable } = useActiveWorkbook();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  const isWorkbookPage = usePathname().startsWith('/workbook') && workbook;

  const form = useForm({
    initialValues: {
      title: '',
      description: '',
    },
    validate: {
      title: (value) => (value.trim().length > 0 ? null : 'Title is required'),
      description: (value) => (value.trim().length > 0 ? null : 'Description is required'),
    },
  });

  const handleSubmit = async () => {
    if (!form.validate().hasErrors) {
      try {
        setIsSubmitting(true);
        const { link } = await bugReportApi.report({
          title: form.values.title,
          userDescription: form.values.description,
          sessionId: getSessionId(),
          replayUrl: getSessionReplayUrl(),
          pageUrl: pathname,
          // add some additional context based on the page the user is on
          workbookId: isWorkbookPage ? workbook?.id : undefined,
          snapshotTableId: isWorkbookPage ? activeTable?.id : undefined,
        });
        form.reset();
        closeReportABugModal();

        let notificationMessage: React.ReactNode = 'Thank you for your report! The dev team was notified.';
        if (user?.isAdmin && link) {
          notificationMessage = (
            <Stack>
              <Text13Book>Thank you for your report! The dev team was notified.</Text13Book>
              <Anchor href={link} target="_blank">
                View in Linear
              </Anchor>
            </Stack>
          );
        }
        // Admins need to close the notification themselves, keeps the linear link open for them.
        ScratchpadNotifications.success({ message: notificationMessage, autoClose: user?.isAdmin ? false : undefined });
      } catch (error) {
        console.error('Failed to submit bug report:', error);
        setError(
          error instanceof Error
            ? error.message
            : 'An unexpected error occured while submitting your bug. please try again',
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = () => {
    form.reset();
    closeReportABugModal();
  };

  if (!isExperimentEnabled('ENABLE_CREATE_BUG_REPORT', user)) {
    return null;
  }

  return (
    <ModalWrapper
      title="Report a Bug"
      size="xl"
      centered
      opened={reportABugModalOpened}
      onClose={handleCancel}
      customProps={{
        footer: (
          <Group>
            <ButtonSecondaryOutline onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleSubmit} loading={isSubmitting}>
              Submit
            </ButtonPrimaryLight>
          </Group>
        ),
      }}
    >
      <Stack gap="md">
        {error && (
          <Alert variant="light" color="red" title="Failed to submit bug report">
            {error}
          </Alert>
        )}
        <TextInput
          label="Title"
          required
          placeholder="Enter a brief title for the bug"
          disabled={isSubmitting}
          {...form.getInputProps('title')}
        />
        <Textarea
          label="Description"
          placeholder="Describe the bug in detail"
          minRows={10}
          autosize
          required
          disabled={isSubmitting}
          {...form.getInputProps('description')}
        />
      </Stack>
    </ModalWrapper>
  );
}
