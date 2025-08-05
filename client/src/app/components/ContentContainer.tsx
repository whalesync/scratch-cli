import { ActionIcon, Group, Stack, Title, Tooltip } from '@mantine/core';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { PropsWithChildren } from 'react';

export type ContentContainerProps = PropsWithChildren<{
  title: string;
  actions?: React.ReactNode;
  onBack?: () => void;
}>;

export const ContentContainer = ({ children, title, actions, onBack }: ContentContainerProps) => {
  return (
    <Stack p="lg" gap={0} w="100%" h="100%">
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          {onBack && (
            <Tooltip label="Back" position="bottom">
              <ActionIcon variant="transparent" onClick={onBack}>
                <ArrowLeftIcon size={24} />
              </ActionIcon>
            </Tooltip>
          )}
          <Title order={2}>{title}</Title>
        </Group>
        {actions}
      </Group>
      {children}
    </Stack>
  );
};
