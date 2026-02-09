'use client';

import { Text13Regular } from '@/app/components/base/text';
import { Box, Stack } from '@mantine/core';

/**
 * Files tab with no file selected - shows empty state
 */
export default function FilesPage() {
  return (
    <Box h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Stack align="center" gap="xs">
        <Text13Regular c="dimmed">Select a file from the sidebar to view its contents</Text13Regular>
      </Stack>
    </Box>
  );
}
