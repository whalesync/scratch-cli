'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { RouteUrls } from '@/utils/route-urls';
import { SignedIn, SignedOut, SignUpButton, UserButton } from '@clerk/nextjs';
import { ActionIcon, CopyButton, Group, Image, NavLink, Stack, Text, Tooltip } from '@mantine/core';
import {
  BookOpenIcon,
  CheckIcon,
  CopyIcon,
  PlugsIcon,
  RobotIcon,
  TableIcon,
  TestTubeIcon,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  {
    href: RouteUrls.snapshotsPageUrl,
    label: 'Snapshots',
    icon: <TableIcon size={16} />,
  },
  {
    href: RouteUrls.connectionsPageUrl,
    label: 'Connections',
    icon: <PlugsIcon size={16} />,
  },
  {
    href: RouteUrls.apiImportDemoPageUrl,
    label: 'AI Connector Builder',
    icon: <RobotIcon size={16} />,
  },
  {
    href: RouteUrls.styleGuidesPageUrl,
    label: 'Style Guides',
    icon: <BookOpenIcon size={16} />,
  },
  {
    href: RouteUrls.healthPageUrl,
    label: 'Health',
    icon: <TestTubeIcon size={16} />,
  },
];

export function SideMenu() {
  const pathname = usePathname();
  const { user } = useScratchPadUser();

  return (
    <Stack gap={0} h="100%">
      <Group justify="flex-start" align="center" p="xs" mb="md" gap="xs">
        <Image
          src="/dolphin-svgrepo-com.svg"
          alt="Scratchpad.ai"
          w={40}
          h={40}
          styles={{
            root: {
              fill: 'd262c1',
            },
          }}
        />
        <Stack p={0} gap={0}>
          <Text size="xl" fw={700}>
            Scratchpad
          </Text>
          <Text size="xs" ml="auto">
            by Whalesync
          </Text>
        </Stack>
      </Group>

      {links.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          component={Link}
          active={pathname === link.href}
          leftSection={link.icon}
        />
      ))}
      <Stack justify="center" mt="auto" p="xs">
        <SignedOut>
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          {user && (
            <Stack gap="xs" pl="xs">
              <Group wrap="nowrap" gap="xs">
                <Text c="dimmed" size="xs">
                  User ID
                </Text>
                <CopyButton value={user.id} timeout={2000}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : `${user.id}`} withArrow position="right">
                      <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                        {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
              {user.apiToken && (
                <>
                  <Group wrap="nowrap" gap="xs">
                    <Text c="dimmed" size="xs">
                      API Token
                    </Text>
                    <CopyButton value={user.apiToken} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? 'Copied' : `${user.apiToken}`} withArrow position="right">
                          <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </Group>
                </>
              )}
            </Stack>
          )}
          <UserButton showName />
        </SignedIn>
      </Stack>
    </Stack>
  );
}
