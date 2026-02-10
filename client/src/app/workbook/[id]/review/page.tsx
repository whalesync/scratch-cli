'use client';

import { Text13Regular } from '@/app/components/base/text';
import { Box } from '@mantine/core';

export default function ReviewPage() {
  return (
    <Box
      p="xl"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <Text13Regular c="dimmed">Select a modified file to review changes</Text13Regular>
    </Box>
  );
}
