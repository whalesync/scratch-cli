import { Button } from '@mantine/core';
import { ArrowUpIcon, CpuIcon, XIcon } from '@phosphor-icons/react';

export const InlineButton = Button.withProps({
  w: 'min-content',
  size: 'compact-sm',
  variant: 'subtle',
  c: 'gray.10',
});

/**
 * Button with default styles for primary actions like saving, continuing, or submitting.
 */
export const PrimaryButton = Button.withProps({
  variant: 'filled',
  // color: 'blue',
  size: 'sm',
});

/**
 * Button with default styles for secondary actions like canceling or triggering optional tools
 */
export const SecondaryButton = Button.withProps({
  variant: 'outline',
  size: 'sm',
});

export const AcceptSuggestionButton = Button.withProps({
  color: 'green',
  size: 'xs',
  leftSection: <ArrowUpIcon size={14} />,
});

export const RejectSuggestionButton = Button.withProps({
  color: 'red',
  size: 'xs',
  leftSection: <XIcon size={14} />,
});

export const DevToolButton = Button.withProps({
  variant: 'outline',
  c: 'purple',
  leftSection: <CpuIcon />,
});
