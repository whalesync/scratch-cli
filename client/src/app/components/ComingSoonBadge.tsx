import { Badge, BadgeProps } from '@mantine/core';

interface ComingSoonBadgeProps extends BadgeProps {
  label?: string;
}

export const ComingSoonBadge = ({ label = 'Coming Soon', ...props }: ComingSoonBadgeProps) => {
  return (
    <Badge variant="light" color="gray" size="xs" tt="uppercase" {...props}>
      {label}
    </Badge>
  );
};
