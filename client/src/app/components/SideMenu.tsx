'use client';

import { RouteUrls } from '@/utils/route-urls';
import { SignedIn, SignedOut, SignUpButton, UserButton } from '@clerk/nextjs';
import { Center, Divider, Image, Stack, Tooltip, UnstyledButton } from '@mantine/core';
import { BookOpenIcon, FileTextIcon, GearIcon, PlugsIcon, RobotIcon, TableIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import styles from './SideMenu.module.css';

const links = [
  {
    href: RouteUrls.snapshotsPageUrl,
    label: 'Snapshots',
    icon: <TableIcon size={24} />,
    enabled: true,
  },
  {
    href: RouteUrls.connectionsPageUrl,
    label: 'Connections',
    icon: <PlugsIcon size={24} />,
    enabled: true,
  },
  {
    href: RouteUrls.apiImportDemoPageUrl,
    label: 'AI Connector Builder',
    icon: <RobotIcon size={24} />,
    enabled: true,
  },
  {
    href: RouteUrls.styleGuidesPageUrl,
    label: 'Style Guides',
    icon: <BookOpenIcon size={24} />,
    enabled: true,
  },
  {
    href: RouteUrls.csvFilesPageUrl,
    label: 'CSV Files',
    icon: <FileTextIcon size={24} />,
    enabled: true,
  },
  {
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: <GearIcon size={24} />,
    enabled: true,
  },
];

export function SideMenu() {
  const pathname = usePathname();

  return (
    <Stack gap={0} h="100%" align="center">
      <Tooltip label="Scratchpad.ai by Whalesync">
        <Center h={50} w={50}>
          <Image
            src="/dolphin-svgrepo-com.svg"
            alt="Scratchpad.ai"
            w={30}
            h={30}
            styles={{
              root: {
                fill: 'd262c1',
              },
            }}
          />
        </Center>
      </Tooltip>
      <Divider w="100%" mb="md" />
      <Stack gap="md">
        {links
          .filter((link) => link.enabled)
          .map((link) => (
            <Tooltip key={link.href} label={link.label} position="right" withArrow transitionProps={{ duration: 0 }}>
              <UnstyledButton
                component={Link}
                href={link.href}
                data-active={pathname.startsWith(link.href) || undefined}
                className={styles.link}
              >
                {link.icon}
              </UnstyledButton>
            </Tooltip>
          ))}
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
