import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ScratchpadPlanType } from '@/types/server-entities/payment';
import { RouteUrls } from '@/utils/route-urls';
import { Modal, Stack } from '@mantine/core';
import Link from 'next/link';
import { JSX } from 'react';
import { TextRegularSm, TextTitleLg } from './base/text';

export const NoSubscriptionDetectedModal = (): JSX.Element => {
  const { signOut } = useScratchPadUser();
  const choosePlanUrl = RouteUrls.productCheckoutPage(ScratchpadPlanType.STARTER_PLAN);

  return (
    <Modal
      withCloseButton={false}
      size="md"
      centered
      closeOnClickOutside={false}
      opened={true}
      onClose={() => {}}
      title={null}
    >
      <Stack gap="xs" mb="md" align="center">
        <TextTitleLg>Get started with Scratchpaper.ai</TextTitleLg>
        <TextRegularSm ta="center">
          Sign up for your 7 day free trial and start editing your data with AI.
        </TextRegularSm>
      </Stack>
      <Stack gap="xs">
        <SecondaryButton onClick={signOut}>Switch accounts</SecondaryButton>
        <PrimaryButton component={Link} href={choosePlanUrl}>
          Start Free Trial
        </PrimaryButton>
      </Stack>
    </Modal>
  );
};
