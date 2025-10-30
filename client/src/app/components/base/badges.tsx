import { Badge, BadgeProps } from '@mantine/core';
import { JSX } from 'react';
import classes from './badges.module.css';

export const BadgeBase = Badge.withProps({
  variant: 'light',
  classNames: { root: classes.badgeRoot },

  size: 'md',
  color: 'surface',
});

export const BadgeOK = (props: BadgeProps): JSX.Element => {
  return (
    <BadgeBase {...props} color="green">
      {props.children ?? 'OK'}
    </BadgeBase>
  );
};

export const BadgeError = (props: BadgeProps): JSX.Element => {
  return (
    <BadgeBase {...props} color="red">
      {props.children ?? 'Error'}
    </BadgeBase>
  );
};
