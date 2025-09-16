import { Button } from '@mantine/core';
import { CpuIcon } from '@phosphor-icons/react';

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
  size: 'xs',
});

/**
 * Button with default styles for secondary actions like canceling or triggering optional tools
 */
export const SecondaryButton = Button.withProps({
  variant: 'outline',
  size: 'xs',
});

export const AcceptSuggestionButton = Button.withProps({
  color: 'green',
  size: 'xs',
  variant: 'outline',
  bdrs: '0px',
});

export const RejectSuggestionButton = Button.withProps({
  color: 'red',
  size: 'xs',
  variant: 'outline',
  bdrs: '0px',
});

export const DevToolButton = Button.withProps({
  variant: 'outline',
  c: 'purple',
  leftSection: <CpuIcon />,
});
