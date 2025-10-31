import { ActionIcon } from '@mantine/core';
import { EllipsisVertical } from 'lucide-react';
import { forwardRef } from 'react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';

export const ActionIconThreeDots = forwardRef<HTMLButtonElement>((props, ref) => {
  return (
    <ActionIcon ref={ref} variant="subtle" size="md" color="text" {...props}>
      <StyledLucideIcon Icon={EllipsisVertical} size={19} />
    </ActionIcon>
  );
});

ActionIconThreeDots.displayName = 'ActionIconThreeDots';
