'use client';

import { ActionIcon, Box, Button, Group, Stack, Text } from '@mantine/core';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import type { OrderContentStepProps } from '../types';

export function OrderContentStep({
  contentColumns,
  onOrderChange,
  onNext,
  onBack,
}: OrderContentStepProps) {
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...contentColumns];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onOrderChange(newOrder);
  };

  const handleMoveDown = (index: number) => {
    if (index === contentColumns.length - 1) return;
    const newOrder = [...contentColumns];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onOrderChange(newOrder);
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="var(--fg-secondary)">
        Set the order in which content columns will appear in the markdown body. Use the arrows to
        reorder.
      </Text>

      <Text size="xs" c="var(--fg-muted)">
        Content will be concatenated in this order, separated by blank lines.
      </Text>

      <Box style={{ border: '1px solid var(--fg-divider)', borderRadius: '4px' }}>
        <Stack gap={0} p="xs">
          {contentColumns.map((column, index) => (
            <Group
              key={column}
              p="xs"
              gap="sm"
              wrap="nowrap"
              style={{
                borderRadius: '4px',
                backgroundColor: 'var(--bg-panel)',
              }}
            >
              <Text size="sm" c="var(--fg-muted)" w={24} ta="center">
                {index + 1}.
              </Text>
              <Text size="sm" fw={500} style={{ flex: 1 }}>
                {column}
              </Text>
              <Group gap={4}>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                >
                  <ArrowUpIcon size={14} />
                </ActionIcon>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === contentColumns.length - 1}
                >
                  <ArrowDownIcon size={14} />
                </ActionIcon>
              </Group>
            </Group>
          ))}
        </Stack>
      </Box>

      <Text size="xs" c="var(--fg-muted)">
        Preview: {contentColumns.join(' → ')}
      </Text>

      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Preview</Button>
      </Group>
    </Stack>
  );
}
