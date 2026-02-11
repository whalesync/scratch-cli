import { MantineSize } from '@mantine/core';
import { LucideIcon } from 'lucide-react';
import { JSX } from 'react';
import { StyledLucideIcon } from './StyledLucideIcon';
import classes from './SpinningIcon.module.css';

export const SpinningIcon = ({
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
  return <StyledLucideIcon Icon={Icon} c={c} size={size} strokeWidth={strokeWidth} className={classes.spinning} />;
};
