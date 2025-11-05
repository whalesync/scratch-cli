import { ActionIcon, MantineSize } from '@mantine/core';
import { EllipsisVertical } from 'lucide-react';
import { forwardRef } from 'react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';

export const ActionIconThreeDots = forwardRef<HTMLButtonElement, { size?: MantineSize }>((props, ref) => {
  return (
    <ActionIcon ref={ref} variant="subtle" size={props.size ?? 'md'} c="var(--fg-muted)" {...props}>
      <StyledLucideIcon Icon={EllipsisVertical} size={props.size ?? 'md'} />
    </ActionIcon>
  );
});

ActionIconThreeDots.displayName = 'ActionIconThreeDots';
