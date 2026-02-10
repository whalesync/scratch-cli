'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text13Medium } from '@/app/components/base/text';
import { RouteUrls } from '@/utils/route-urls';
import { Box, Group, UnstyledButton } from '@mantine/core';
import { ArrowLeftIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';

export function SettingsHeader() {
  return (
    <Box
      px="sm"
      py="xs"
      style={{
        borderBottom: '1px solid var(--fg-divider)',
      }}
    >
      <Group gap="xs">
        <Link href={RouteUrls.homePageUrl} style={{ textDecoration: 'none' }}>
          <UnstyledButton
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 4,
            }}
          >
            <StyledLucideIcon Icon={ArrowLeftIcon} size="sm" c="var(--fg-muted)" />
          </UnstyledButton>
        </Link>
        <Group gap={6}>
          <StyledLucideIcon Icon={SettingsIcon} size="sm" c="var(--fg-muted)" />
          <Text13Medium c="var(--fg-primary)">Settings</Text13Medium>
        </Group>
      </Group>
    </Box>
  );
}
