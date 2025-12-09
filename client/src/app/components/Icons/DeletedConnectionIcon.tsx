import { DecorativeBoxedIcon } from '@/app/components/Icons/DecorativeBoxedIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Box, Tooltip } from '@mantine/core';
import { CloudOffIcon } from 'lucide-react';

export function DeletedConnectionIcon({
  tooltipEnabled = true,
  tooltipLabel,
  decorative = true,
}: {
  size?: number;
  tooltipEnabled?: boolean;
  tooltipLabel?: string;
  decorative?: boolean;
}) {
  const box = (
    <Box display="inline-flex">
      {decorative ? (
        <DecorativeBoxedIcon Icon={CloudOffIcon} size="xs" />
      ) : (
        <StyledLucideIcon Icon={CloudOffIcon} size={16} />
      )}
    </Box>
  );
  return tooltipEnabled ? (
    <Tooltip key={`deleted-connection`} label={tooltipLabel ?? 'Connection deleted'}>
      {box}
    </Tooltip>
  ) : (
    box
  );
}
