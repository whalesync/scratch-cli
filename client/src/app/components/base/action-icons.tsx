import { ActionIcon } from '@mantine/core';
import { EllipsisVertical } from 'lucide-react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';

export const ActionIconThreeDots = () => {
  return (
    <ActionIcon variant="subtle" size="md" color="text">
      <StyledLucideIcon Icon={EllipsisVertical} size={19} />
    </ActionIcon>
  );
};
