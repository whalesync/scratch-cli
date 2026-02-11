import { MantineSize } from '@mantine/core';
import { LucideIcon } from 'lucide-react';
import { JSX } from 'react';
import classes from './PulsingIcon.module.css';
import { StyledLucideIcon } from './StyledLucideIcon';

export const PulsingIcon = ({
  Icon,
  c,
  size,
  strokeWidth,
}: {
  Icon: LucideIcon;
  c?: string;
  size?: MantineSize | number;
  strokeWidth?: number;
}): JSX.Element => {
  return <StyledLucideIcon Icon={Icon} c={c} size={size} strokeWidth={strokeWidth} className={classes.pulsing} />;
};
