import { Box, Tooltip } from '@mantine/core';
import { CloudOffIcon } from 'lucide-react';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

export function DeletedConnectionIcon({ size }: { size?: number }) {
  return (
    <Tooltip key={`deleted-connection`} label="Connection deleted">
      <Box display="inline-flex">
        <StyledLucideIcon Icon={CloudOffIcon} size={size ?? 21} c="red" />
      </Box>
    </Tooltip>
  );
}
