import { Box } from '@mantine/core';
import { FC, ReactNode } from 'react';

export const OnboardingRow: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <Box pl={10} pr={10} pt={10} pb={10}>
      {children}
    </Box>
  );
};
