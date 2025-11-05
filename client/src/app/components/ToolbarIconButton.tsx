import { LucideIcon } from 'lucide-react';

import { ActionIcon, MantineSize, Tooltip } from '@mantine/core';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

type ToolbarIconButtonProps = {
  icon: LucideIcon;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  title: string;
  size?: MantineSize;
  loading?: boolean;
  disabled?: boolean;
};

export const ToolbarIconButton = ({ icon, onClick, size = 'sm', title, loading, disabled }: ToolbarIconButtonProps) => {
  return (
    <Tooltip label={title}>
      <ActionIcon
        variant="subtle"
        color="gray.7"
        size={size}
        onClick={onClick}
        title={title}
        loading={loading}
        disabled={disabled}
      >
        <StyledLucideIcon Icon={icon} size={size} />
      </ActionIcon>
    </Tooltip>
  );
};
