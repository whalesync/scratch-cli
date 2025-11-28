import { Group, MantineStyleProps } from '@mantine/core';
import { LucideIcon } from 'lucide-react';
import { JSX } from 'react';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';
import classes from './badge.module.css';
import { Text13Regular } from './text';

type BadgeProps = {
  children?: React.ReactNode;
  icon?: LucideIcon;
  color?: 'black' | 'gray' | 'green' | 'red' | 'devTool';
} & MantineStyleProps;

export const Badge = ({ children, color = 'gray', icon, ...styleProps }: BadgeProps): JSX.Element => {
  return (
    <Group gap={6} className={classes.root} data-badge-color={color} {...styleProps}>
      {icon && <StyledLucideIcon Icon={icon} size={12} />}
      <Text13Regular>{children}</Text13Regular>
    </Group>
  );
};

export const BadgeOK = ({ children, ...props }: BadgeProps): JSX.Element => {
  return (
    <Badge color="green" {...props}>
      {children ?? 'OK'}
    </Badge>
  );
};

export const BadgeError = ({ children, ...props }: BadgeProps): JSX.Element => {
  return (
    <Badge color="red" {...props}>
      {children ?? 'Error'}
    </Badge>
  );
};
