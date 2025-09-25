import { LucideIcon } from 'lucide-react';

import { ActionIcon, MantineSize, Tooltip } from '@mantine/core';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

// TODO: extend from ActionIconProps
interface ToolIconButtonProps {
  icon: LucideIcon;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  size?: MantineSize;
  color?: string;
  title?: string;
  tooltip?: string;
  loading?: boolean;
  disabled?: boolean;
}

export const ToolIconButton = ({
  icon,
  onClick,
  size = 'sm',
  color = 'gray',
  title,
  tooltip,
  loading,
  disabled,
}: ToolIconButtonProps) => {
  const button = (
    <ActionIcon
      variant="transparent-hover"
      color={color}
      size={size}
      onClick={onClick}
      title={title}
      loading={loading}
      disabled={disabled}
    >
      <StyledLucideIcon Icon={icon} size={size} />
    </ActionIcon>
  );
  if (tooltip) {
    return <Tooltip label={tooltip}>{button}</Tooltip>;
  }
  return button;
};
