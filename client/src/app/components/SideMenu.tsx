'use client';

import { RouteUrls } from '@/utils/route-urls';
import { SignedIn, SignedOut, SignUpButton, UserButton } from '@clerk/nextjs';
import { Center, Divider, Image, Stack, Tooltip, UnstyledButton } from '@mantine/core';
import { BookOpenIcon, FileCsvIcon, GearIcon, PlugsIcon, RobotIcon, TableIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { StyledIcon } from './Icons/StyledIcon';
import styles from './SideMenu.module.css';

const links = [
  {
    href: RouteUrls.snapshotsPageUrl,
    label: 'Snapshots',
    icon: TableIcon,
    enabled: true,
    requiresAdmin: false,
  },
  {
    href: RouteUrls.connectionsPageUrl,
    label: 'Connections',
    icon: PlugsIcon,
    enabled: true,
    requiresAdmin: false,
  },
  {
    href: RouteUrls.apiImportDemoPageUrl,
    label: 'AI Connector Builder',
    icon: RobotIcon,
    enabled: true,
    requiresAdmin: true,
  },
  {
    href: RouteUrls.styleGuidesPageUrl,
    label: 'Style Guides',
    icon: BookOpenIcon,
    enabled: true,
    requiresAdmin: false,
  },
  {
    href: RouteUrls.csvFilesPageUrl,
    label: 'CSV Files',
    icon: FileCsvIcon,
    enabled: true,
    requiresAdmin: false,
  },
  {
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: GearIcon,
    enabled: true,
    requiresAdmin: false,
  },
];

export function SideMenu() {
  const pathname = usePathname();
  const { isAdmin } = useScratchPadUser();

  return (
    <Stack gap={0} h="100%" align="center">
      <Tooltip label="Scratchpad.ai by Whalesync">
        <Center h={50} w={50}>
          <Link href={RouteUrls.homePageUrl}>
            <Image
              src="/dolphin-svgrepo-com.svg"
              alt="Scratchpad.ai"
              w={30}
              h={30}
              styles={{
                root: {
                  fill: 'var(--mantine-color-primary-5)',
                },
              }}
            />
          </Link>
        </Center>
      </Tooltip>
      <Divider w="100%" mb="md" />
      <Stack gap="md">
        {links
          .filter((link) => link.enabled && (isAdmin || !link.requiresAdmin))
          .map((link) => {
            const isActive = pathname.startsWith(link.href);
            const isAdminLink = link.requiresAdmin && isAdmin;

            const color = isActive ? 'gray.9' : isAdminLink ? 'purple' : 'gray.6';

            return (
              <Tooltip key={link.href} label={link.label} position="right" withArrow transitionProps={{ duration: 0 }}>
                <UnstyledButton
                  component={Link}
                  href={link.href}
                  data-active={isActive || undefined}
                  className={styles.link}
                >
                  <StyledIcon Icon={link.icon} size={24} c={color} />
                </UnstyledButton>
              </Tooltip>
            );
          })}
      </Stack>
      <Stack justify="center" mt="auto" p="xs">
        <SignedOut>
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </Stack>
    </Stack>
  );
}
