import { Box, BoxProps } from '@mantine/core';
import { FC, ReactNode } from 'react';

export const OnboardingRow: FC<BoxProps & { children: ReactNode }> = ({ children, ...props }) => {
  return (
    <Box pl={12} pr={12} pt={10} pb={10} {...props}>
      {children}
    </Box>
  );
};
