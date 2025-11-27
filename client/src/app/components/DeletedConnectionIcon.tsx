import { Box, Tooltip } from '@mantine/core';
import { CloudOffIcon } from 'lucide-react';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

export function DeletedConnectionIcon({
  size,
  tooltipEnabled = true,
  tooltipLabel,
}: {
  size?: number;
  tooltipEnabled?: boolean;
  tooltipLabel?: string;
}) {
  const box = (
    <Box display="inline-flex">
      <StyledLucideIcon Icon={CloudOffIcon} size={size ?? 21} c="red" />
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
