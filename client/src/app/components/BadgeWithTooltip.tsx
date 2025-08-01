import { Badge, BadgeProps, Tooltip } from '@mantine/core';
import { JSX } from 'react';

type BadgeWithTooltipProps = BadgeProps & { tooltip: string };

export const BadgeWithTooltip = (props: BadgeWithTooltipProps): JSX.Element => {
  return (
    <Tooltip label={props.tooltip}>
      <Badge {...props}>{props.children}</Badge>
    </Tooltip>
  );
};
