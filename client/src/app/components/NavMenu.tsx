'use client';

import { RouteUrls } from '@/utils/route-urls';
import { SignedIn, SignedOut, SignUpButton, UserButton } from '@clerk/nextjs';
import { Center, Image, Stack, Tooltip, UnstyledButton, useMantineColorScheme } from '@mantine/core';
// import { Icon } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PROJECT_NAME } from '@/constants';
import { trackToggleDisplayMode } from '@/lib/posthog';
import { BookOpen, Bot, Cpu, LucideIcon, MoonIcon, Settings, SunIcon, Table2, Unplug, Upload } from 'lucide-react';
import { useDevTools } from '../../hooks/use-dev-tools';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';
import styles from './NavMenu.module.css';
import customBorderStyles from './theme/custom-borders.module.css';

type MenuItem = {
  href: string;
  label: string;

  enabled: boolean;
  icon: LucideIcon;
  iconType: 'lucide';

  isDevTool?: boolean;
};

const lowerLinks: MenuItem[] = [
  {
    href: RouteUrls.devToolsPageUrl,
    label: 'Dev Tools',
    icon: Cpu,
    iconType: 'lucide',
    enabled: true,
    isDevTool: true,
  },
  {
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: Settings,
    iconType: 'lucide',
    enabled: true,
  },
];

const upperLinks: MenuItem[] = [
  {
    href: RouteUrls.snapshotsPageUrl,
    label: 'Workbooks',
    icon: Table2,
    iconType: 'lucide',
    enabled: true,
  },
  {
    href: RouteUrls.connectionsPageUrl,
    label: 'Connections',
    icon: Unplug,
    iconType: 'lucide',
    enabled: true,
  },
  {
    href: RouteUrls.uploadsPageUrl,
    label: 'Uploads',
    icon: Upload,
    iconType: 'lucide',
    enabled: true,
  },
  {
    href: RouteUrls.resourcesPageUrl,
    label: 'Resources',
    icon: BookOpen,
    iconType: 'lucide',
    enabled: true,
  },
  {
    href: RouteUrls.apiImportDemoPageUrl,
    label: 'AI Connector Builder',
    icon: Bot,
    iconType: 'lucide',
    enabled: true,
    isDevTool: true,
  },
];

export function NavMenu() {
  const pathname = usePathname();
  const { isDevToolsEnabled } = useDevTools();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const createMenuItem = (link: MenuItem, isActive: boolean) => {
    return (
      <Tooltip key={link.href} label={link.label} position="right" withArrow transitionProps={{ duration: 0 }}>
        <UnstyledButton
          h={28}
          w={28}
          component={Link}
          href={link.href}
          data-active={isActive || undefined}
          data-dev-tool={link.isDevTool || undefined}
          className={`${styles.navButton} ${isActive ? customBorderStyles.cornerBorders : ''}`}
        >
          <StyledLucideIcon Icon={link.icon} size={16} />
        </UnstyledButton>
      </Tooltip>
    );
  };

  return (
    <Stack gap={0} h="100%" align="center">
      <Tooltip label={`${PROJECT_NAME} by Whalesync`}>
        <Link href={RouteUrls.homePageUrl}>
          <Image
            src="/logo-color.svg"
            alt={`${PROJECT_NAME}`}
            w={28}
            h={28}
            my="md"
            styles={{
              root: {
                fill: 'var(--mantine-color-primary-5)',
              },
            }}
          />
        </Link>
      </Tooltip>

      <Stack gap="md">
        {upperLinks
          .filter((link) => link.enabled && (isDevToolsEnabled || !link.isDevTool))
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
          {lowerLinks
            .filter((link) => link.enabled && (isDevToolsEnabled || !link.isDevTool))
            .map((link) => {
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
