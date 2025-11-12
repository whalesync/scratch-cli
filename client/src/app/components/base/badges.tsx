import { Badge, BadgeProps } from '@mantine/core';
import { JSX } from 'react';

export const BadgeOK = (props: BadgeProps): JSX.Element => {
  return (
    <Badge {...props} color="green">
      {props.children ?? 'OK'}
    </Badge>
  );
};

export const BadgeError = (props: BadgeProps): JSX.Element => {
  return (
    <Badge {...props} color="red">
      {props.children ?? 'Error'}
    </Badge>
  );
};
