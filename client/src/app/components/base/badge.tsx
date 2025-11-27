import { MantineStyleProps } from '@mantine/core';
import { JSX } from 'react';
import classes from './badge.module.css';
import { Text13Regular } from './text';

type BadgeProps = {
  children?: React.ReactNode;
  color?: 'black' | 'gray' | 'green' | 'red' | 'devTool';
} & MantineStyleProps;

export const Badge = ({ children, color = 'gray', ...props }: BadgeProps): JSX.Element => {
  return (
    <Text13Regular className={classes.root} data-badge-color={color} {...props}>
      {children}
    </Text13Regular>
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
