'use client';

import { TextMono12Regular } from '@/app/components/base/text';
import { Box, Group, Stack } from '@mantine/core';
import { ChatMessage } from '@spinner/shared-types';
import { ChevronDownIcon } from 'lucide-react';
import { StyledLucideIcon } from '../../../../components/Icons/StyledLucideIcon';
import classes from './AIChatPanel.module.css';
import { ChatMessageElement } from './ChatMessageElement';

/**
 * Collapsible group of progress messages
 */
export const ProgressMessageGroup = ({
  messages,
  isLastMessageProgress,
}: {
  messages: ChatMessage[];
  isLastMessageProgress: boolean;
}) => {
  return (
    <Box>
      <Group flex={1} gap={10} align="center">
        <StyledLucideIcon Icon={ChevronDownIcon} size={14} />
        <Group flex={1} gap={0} justify="space-between">
          <TextMono12Regular c="dimmed" style={{ textTransform: 'uppercase' }}>
            [WORKING]
          </TextMono12Regular>
          {isLastMessageProgress && (
            <TextMono12Regular c="dimmed" style={{ textTransform: 'uppercase' }}>
              <span className={classes.progressLoading}>[</span>
              <span>]</span>
            </TextMono12Regular>
          )}
        </Group>
      </Group>
      <Stack ml="md" gap="xs" mt="xs">
        {messages.map((msg, index) => (
          <ChatMessageElement key={index} msg={msg} />
        ))}
      </Stack>
    </Box>
  );
};
