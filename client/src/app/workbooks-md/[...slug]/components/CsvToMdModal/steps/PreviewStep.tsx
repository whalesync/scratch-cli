'use client';

import { Box, Button, Code, Divider, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { FileTextIcon } from 'lucide-react';
import type { PreviewStepProps } from '../types';

export function PreviewStep({
  previews,
  totalRows,
  folderName,
  onNext,
  onBack,
}: PreviewStepProps) {
  return (
    <Stack gap="md">
      <Text size="sm" c="var(--fg-secondary)">
        Preview of the markdown files that will be created. Showing {previews.length} of {totalRows}{' '}
        records.
      </Text>

      <Group gap="sm">
        <Text size="sm" fw={500}>
          Folder name:
        </Text>
        <Code>{folderName}/</Code>
      </Group>

      <ScrollArea h={320} style={{ border: '1px solid var(--fg-divider)', borderRadius: '4px' }}>
        <Stack gap="md" p="sm">
          {previews.map((preview, index) => (
            <Box key={index}>
              {index > 0 && <Divider mb="md" />}
              <Stack gap="xs">
                <Group gap="xs">
                  <FileTextIcon size={14} color="var(--fg-secondary)" />
                  <Text size="sm" fw={600} c="var(--mantine-color-blue-7)">
                    {preview.filename}
                  </Text>
                </Group>

                {Object.keys(preview.frontmatter).length > 0 && (
                  <Box>
                    <Text size="xs" fw={500} c="var(--fg-secondary)" mb={4}>
                      Frontmatter:
                    </Text>
                    <Code
                      block
                      style={{
                        fontSize: '11px',
                        maxHeight: '100px',
                        overflow: 'auto',
                      }}
                    >
                      {Object.entries(preview.frontmatter)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('\n')}
                    </Code>
                  </Box>
                )}

                {preview.body && (
                  <Box>
                    <Text size="xs" fw={500} c="var(--fg-secondary)" mb={4}>
                      Content body:
                    </Text>
                    <Box
                      style={{
                        backgroundColor: 'var(--bg-panel)',
                        borderRadius: '4px',
                        padding: '8px',
                        maxHeight: '100px',
                        overflow: 'auto',
                      }}
                    >
                      <Text size="xs" style={{ whiteSpace: 'pre-wrap' }}>
                        {preview.body.length > 300
                          ? preview.body.slice(0, 300) + '...'
                          : preview.body}
                      </Text>
                    </Box>
                  </Box>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      </ScrollArea>

      {totalRows > previews.length && (
        <Text size="xs" c="var(--fg-muted)" ta="center">
          ... and {totalRows - previews.length} more files will be created
        </Text>
      )}

      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Create {totalRows} Files
        </Button>
      </Group>
    </Stack>
  );
}
