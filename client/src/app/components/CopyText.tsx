import { ActionIcon, Box, CopyButton, Group, Tooltip } from '@mantine/core';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { Text13Regular } from './base/text';

/**
 * @param value - The value to display.
 * @returns A element that displays the value and a copy button.
 */
export const CopyText = ({ value }: { value: string }) => {
  return (
    <Group gap="xs">
      {typeof value === 'string' ? (
        <Text13Regular style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
          {value}
        </Text13Regular>
      ) : (
        <Box>{value}</Box>
      )}

      <CopyButton value={typeof value === 'string' ? value : JSON.stringify(value)} timeout={2000}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
            <ActionIcon color={copied ? 'blue' : 'gray'} size="xs" variant="subtle" onClick={copy}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
};
