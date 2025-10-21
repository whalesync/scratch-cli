import { Box, Group, Text } from '@mantine/core';
import { FC } from 'react';

export interface SuggestionItemProps {
  title: string;
  description: string;
}

export const SuggestionItem: FC<SuggestionItemProps> = ({ title, description }: SuggestionItemProps) => {
  return (
    <Group justify="space-between" gap={5} p={3} pl={7} pr={7}>
      <Text size="sm">{title}</Text>
      <Box w={10} />
      <Text size="xs" c="dimmed">
        {description}
      </Text>
    </Group>
  );
};
