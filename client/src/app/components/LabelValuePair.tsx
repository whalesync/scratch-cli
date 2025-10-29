import { ActionIcon, Box, CopyButton, Group, Tooltip } from '@mantine/core';
import { CheckIcon, CopyIcon } from 'lucide-react';

import { JSX, ReactNode } from 'react';
import { TextSmHeavier, TextSmRegular } from './base/text';

export const LabelValuePair = ({
  label,
  value,
  canCopy,
  minLabelWidth,
}: {
  label: ReactNode;
  value: ReactNode;
  canCopy?: boolean;
  minLabelWidth?: string | number;
}): JSX.Element => {
  return (
    <Group wrap="nowrap" align="start" gap="sm">
      <TextSmHeavier miw={minLabelWidth ?? '180px'}>{label}</TextSmHeavier>

      <Group gap={canCopy ? 'xs' : '0'}>
        {typeof value === 'string' ? (
          <TextSmRegular style={{ wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
            {value}
          </TextSmRegular>
        ) : (
          <Box>{value}</Box>
        )}

        {canCopy ? (
          <CopyButton value={typeof value === 'string' ? value : JSON.stringify(value)} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow position="right">
                <ActionIcon color={copied ? 'blue' : 'gray'} size="xs" variant="subtle" onClick={copy}>
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        ) : null}
      </Group>
    </Group>
  );
};
