'use client';

import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text13Regular, Text16Medium, TextMono12Regular } from '@/app/components/base/text';
import { Badge, Box, Group, Stack } from '@mantine/core';
import type { DataFolderGroup } from '@spinner/shared-types';
import { FolderIcon, StickyNoteIcon } from 'lucide-react';

const SCRATCH_GROUP_NAME = 'Scratch';

interface ConnectionDetailProps {
  group: DataFolderGroup;
}

export function ConnectionDetail({ group }: ConnectionDetailProps) {
  const isScratch = group.name === SCRATCH_GROUP_NAME;
  const isConnected = true; // Would come from connection status

  return (
    <Box p="lg">
      <Stack gap="lg">
        {/* Header */}
        <Group gap="md">
          {isScratch ? (
            <Box
              p="sm"
              style={{
                backgroundColor: 'var(--bg-selected)',
                borderRadius: 8,
              }}
            >
              <StyledLucideIcon Icon={StickyNoteIcon} size="lg" c="var(--fg-secondary)" />
            </Box>
          ) : group.service ? (
            <Box
              p="sm"
              style={{
                backgroundColor: 'var(--bg-selected)',
                borderRadius: 8,
              }}
            >
              <ConnectorIcon connector={group.service} size={32} p={0} />
            </Box>
          ) : (
            <Box
              p="sm"
              style={{
                backgroundColor: 'var(--bg-selected)',
                borderRadius: 8,
              }}
            >
              <StyledLucideIcon Icon={FolderIcon} size="lg" c="var(--fg-secondary)" />
            </Box>
          )}

          <Stack gap={4}>
            <Text16Medium>{group.name}</Text16Medium>
            <Group gap="xs">
              <Badge size="sm" variant="light" color={isConnected ? 'green' : 'red'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </Group>
          </Stack>
        </Group>

        {/* Stats */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Text13Regular c="var(--fg-secondary)">Tables</Text13Regular>
            <TextMono12Regular>{group.dataFolders.length}</TextMono12Regular>
          </Group>

          {group.service && (
            <Group justify="space-between">
              <Text13Regular c="var(--fg-secondary)">Service</Text13Regular>
              <TextMono12Regular>{group.service}</TextMono12Regular>
            </Group>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
