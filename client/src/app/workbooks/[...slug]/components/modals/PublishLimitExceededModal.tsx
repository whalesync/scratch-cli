import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { useSubscription } from '@/hooks/use-subscription';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Modal, Stack, Text } from '@mantine/core';
import { CircleAlertIcon } from 'lucide-react';
import { StatusListItem } from './StatusListItem';

interface PublishLimitExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName?: string;
}

export const PublishLimitExceededModal = ({ isOpen, serviceName, onClose }: PublishLimitExceededModalProps) => {
  const { subscription } = useSubscription();
  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <Text>
          Publishing data to <strong>{serviceName}</strong>.
        </Text>
      }
      centered
      size="lg"
    >
      <Stack gap="md">
        <StatusListItem
          bgColor="var(--mantine-color-red-2)"
          text1="You have reached your publishing limit for the month."
          text2={`You can publish up to ${subscription.features.publishingLimit} times per month.`}
          iconProps={{ Icon: CircleAlertIcon, c: 'var(--mantine-color-red-6)', size: 'md' }}
        />
        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight
            onClick={() => {
              window.location.href = RouteUrls.billingPageUrl;
            }}
          >
            Upgrade Plan
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
