'use client';

import { RouteUrls } from '@/utils/route-urls';
import { SignedIn, SignedOut, SignUpButton, UserButton } from '@clerk/nextjs';
import { Center, Image, Stack, Tooltip, UnstyledButton, useMantineColorScheme } from '@mantine/core';
// import { Icon } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PROJECT_NAME } from '@/constants';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { trackToggleDisplayMode } from '@/lib/posthog';
import {
  BookOpen,
  Bot,
  FileSpreadsheet,
  LucideIcon,
  MoonIcon,
  NotebookPen,
  Pickaxe,
  Settings,
  SunIcon,
  Unplug,
  Upload,
} from 'lucide-react';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';
import styles from './NavMenu.module.css';

type MenuItem = {
  href: string;
  label: string;

  enabled: boolean;
  requiresAdmin: boolean;
  icon: LucideIcon;
  iconType: 'lucide';
};

const lowerLinks: MenuItem[] = [
  {
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: Settings,
    iconType: 'lucide',
    enabled: true,
    requiresAdmin: false,
  },
];

const upperLinks = (isUseJobsEnabled: boolean): MenuItem[] => {
  return [
    {
      href: RouteUrls.snapshotsPageUrl,
      label: 'Workbooks',
      icon: NotebookPen,
      iconType: 'lucide',
      enabled: true,
      requiresAdmin: false,
    },
    {
      href: RouteUrls.connectionsPageUrl,
      label: 'Connections',
      icon: Unplug,
      iconType: 'lucide',
      enabled: true,
      requiresAdmin: false,
    },
    {
      href: RouteUrls.uploadsPageUrl,
      label: 'Uploads',
      icon: Upload,
      iconType: 'lucide',
      enabled: true,
      requiresAdmin: false,
    },
    {
      href: RouteUrls.resourcesPageUrl,
      label: 'Resources',
      icon: BookOpen,
      iconType: 'lucide',
      enabled: true,
      requiresAdmin: false,
    },
    ...(isUseJobsEnabled
      ? [
          {
            href: RouteUrls.jobsPageUrl,
            label: 'Jobs',
            icon: Pickaxe,
            iconType: 'lucide' as const,
            enabled: true,
            requiresAdmin: false,
          },
        ]
      : []),
    {
      href: RouteUrls.csvFilesPageUrl,
      label: 'CSV Files',
      icon: FileSpreadsheet,
      iconType: 'lucide',
      enabled: true,
      requiresAdmin: true,
    },
    {
      href: RouteUrls.apiImportDemoPageUrl,
      label: 'AI Connector Builder',
      icon: Bot,
      iconType: 'lucide',
      enabled: true,
      requiresAdmin: true,
    },
  ];
};

export function NavMenu() {
  const pathname = usePathname();
  const { isAdmin, user } = useScratchPadUser();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const isUseJobsEnabled = user?.experimentalFlags?.USE_JOBS ?? false;

  const createMenuItem = (link: MenuItem, isActive: boolean) => {
    return (
      <Tooltip key={link.href} label={link.label} position="right" withArrow transitionProps={{ duration: 0 }}>
        <UnstyledButton
          h={36}
          w={36}
          component={Link}
          href={link.href}
          data-active={isActive || undefined}
          className={styles.navButton}
        >
          <StyledLucideIcon Icon={link.icon} size={20} />
        </UnstyledButton>
      </Tooltip>
    );
  };

  return (
    <Stack gap={0} h="100%" align="center">
      <Tooltip label={`${PROJECT_NAME} by Whalesync`}>
        <Center h={40} w={40}>
          <Link href={RouteUrls.homePageUrl}>
            <Image
              src="/logo-color.svg"
              alt={`${PROJECT_NAME}`}
              w={40}
              h={40}
              styles={{
                root: {
                  fill: 'var(--mantine-color-primary-5)',
                },
              }}
            />
          </Link>
        </Center>
      </Tooltip>

      <Stack gap="md">
        {upperLinks(isUseJobsEnabled)
          .filter((link) => link.enabled && (isAdmin || !link.requiresAdmin))
          .map((link) => {
            const isActive = pathname.startsWith(link.href);
            return createMenuItem(link, isActive);
          })}
      </Stack>
      <Stack justify="center" mt="auto" p="xs" gap="xs">
        <SignedOut>
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          {lowerLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return createMenuItem(link, isActive);
          })}
          <UnstyledButton
            onClick={() => {
              setColorScheme(colorScheme === 'light' ? 'dark' : 'light');
              trackToggleDisplayMode(colorScheme === 'light' ? 'dark' : 'light');
            }}
            className={styles.navButton}
          >
            {colorScheme === 'light' ? (
              <StyledLucideIcon Icon={MoonIcon} size={20} />
            ) : (
              <StyledLucideIcon Icon={SunIcon} size={20} />
            )}
          </UnstyledButton>
          <Center>
            <UserButton />
          </Center>
        </SignedIn>
      </Stack>
    </Stack>
  );
}
