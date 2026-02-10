'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text13Regular } from '@/app/components/base/text';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { RouteUrls } from '@/utils/route-urls';
import { UserButton } from '@clerk/nextjs';
import { Box, Group, Stack, UnstyledButton } from '@mantine/core';
import { ChevronDownIcon, SettingsIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function SidebarFooter() {
  const pathname = usePathname();
  const { user, clerkUser } = useScratchPadUser();

  const isSettingsActive = pathname.startsWith(RouteUrls.settingsPageUrl);

  // Get user's display name
  const displayName = user?.name || clerkUser?.firstName || clerkUser?.username || 'User';

  return (
    <Stack
      gap={0}
      py="xs"
      style={{
        borderTop: '1px solid var(--fg-divider)',
        flexShrink: 0,
      }}
    >
      {/* User chip */}
      <Box pos="relative">
        <UnstyledButton
          px="sm"
          py={8}
          style={{
            width: '100%',
          }}
        >
          <Group gap={8} wrap="nowrap" justify="space-between">
            <Group gap={8} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Box
                w={20}
                h={20}
                style={{
                  borderRadius: '50%',
                  backgroundColor: 'var(--mantine-color-blue-6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Text13Regular c="white" style={{ fontSize: 11, fontWeight: 600 }}>
                  {displayName.charAt(0).toUpperCase()}
                </Text13Regular>
              </Box>
              <Text13Regular c="var(--fg-primary)" truncate style={{ flex: 1 }}>
                {displayName}
              </Text13Regular>
            </Group>
            <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
          </Group>
        </UnstyledButton>

        {/* Invisible overlay to trigger Clerk UserButton menu */}
        <Box pos="absolute" top={0} left={0} w="100%" h="100%" style={{ zIndex: 10, opacity: 0, overflow: 'hidden' }}>
          <UserButton
            appearance={{
              elements: {
                rootBox: { width: '100%', height: '100%' },
                userButtonTrigger: { width: '100%', height: '100%', cursor: 'pointer' },
              },
            }}
          />
        </Box>
      </Box>

      {/* Settings link */}
      <Link href={RouteUrls.settingsPageUrl} style={{ textDecoration: 'none' }}>
        <UnstyledButton
          px="sm"
          py={8}
          style={{
            width: '100%',
            backgroundColor: isSettingsActive ? 'var(--bg-selected)' : 'transparent',
          }}
        >
          <Group gap={8} wrap="nowrap">
            <StyledLucideIcon
              Icon={SettingsIcon}
              size="sm"
              c={isSettingsActive ? 'var(--fg-primary)' : 'var(--fg-secondary)'}
            />
            <Text13Regular c={isSettingsActive ? 'var(--fg-primary)' : 'var(--fg-secondary)'}>Settings</Text13Regular>
          </Group>
        </UnstyledButton>
      </Link>
    </Stack>
  );
}
