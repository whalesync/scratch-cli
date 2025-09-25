import { Button } from '@mantine/core';
import { Cpu } from 'lucide-react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';

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
  variant: 'outline',
  size: 'xs',
  color: 'primary', // border
  c: 'primary', // text
});

/**
 * Button with default styles for secondary actions like canceling or triggering optional tools
 */
export const SecondaryButton = Button.withProps({
  variant: 'outline',
  size: 'xs',
  color: 'secondary',
  c: 'secondary',
});

export const AcceptSuggestionButton = Button.withProps({
  size: 'xs',
  variant: 'outline',
  color: 'primary', // border
  c: 'primary', // text
});

export const RejectSuggestionButton = Button.withProps({
  size: 'xs',
  variant: 'outline',
  color: 'secondary',
  c: 'secondary',
});

export const DevToolButton = Button.withProps({
  variant: 'outline',
  c: 'purple',
  color: 'purple',
  leftSection: <StyledLucideIcon Icon={Cpu} />,
});

export const ContentFooterButton = Button.withProps({
  variant: 'subtle',
  size: 'xs',
  c: 'gray',
});
