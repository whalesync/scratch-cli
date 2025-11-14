'use client';

import { RouteUrls } from '@/utils/route-urls';
import { SignedIn, SignedOut, SignUpButton, UserButton } from '@clerk/nextjs';
import { Center, Image, Stack, Tooltip, UnstyledButton, useMantineColorScheme } from '@mantine/core';
// import { Icon } from '@phosphor-icons/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { PROJECT_NAME } from '@/constants';
import { trackToggleDisplayMode } from '@/lib/posthog';
import { BookOpen, Cpu, LucideIcon, MoonIcon, Settings, SunIcon, Table2, Unplug } from 'lucide-react';
import { useDevTools } from '../../hooks/use-dev-tools';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';
import styles from './NavMenu.module.css';
import customBorderStyles from './theme/custom-borders.module.css';

type MenuItem = {
  label: string;
  enabled: boolean;
  icon: LucideIcon;
  iconType: 'lucide';

  isDevTool?: boolean;
} & ({ type: 'link'; href: string } | { type: 'button'; onClick: () => void });

const lowerLinks: MenuItem[] = [
  {
    type: 'link',
    href: RouteUrls.devToolsPageUrl,
    label: 'Dev Tools',
    icon: Cpu,
    iconType: 'lucide',
    enabled: true,
    isDevTool: true,
  },
  {
    type: 'link',
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: Settings,
    iconType: 'lucide',
    enabled: true,
  },
];

const upperLinks: MenuItem[] = [
  {
    type: 'link',
    href: RouteUrls.snapshotsPageUrl,
    label: 'Workbooks',
    icon: Table2,
    iconType: 'lucide',
    enabled: true,
  },
  {
    type: 'link',
    href: RouteUrls.dataSourcesPageUrl,
    label: 'Data sources',
    icon: Unplug,
    iconType: 'lucide',
    enabled: true,
  },
  {
    type: 'link',
    href: RouteUrls.resourcesPageUrl,
    label: 'Resources',
    icon: BookOpen,
    iconType: 'lucide',
    enabled: true,
  },
];

export function NavMenu() {
  const pathname = usePathname();
  const { isDevToolsEnabled } = useDevTools();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const createMenuItem = (link: MenuItem, isActive: boolean) => {
    const icon = <StyledLucideIcon Icon={link.icon} size={16} />;
    return (
      <Tooltip key={link.label} label={link.label} position="right" withArrow transitionProps={{ duration: 0 }}>
        {link.type === 'button' ? (
          <UnstyledButton
            component="button"
            onClick={link.onClick}
            data-active={isActive || undefined}
            data-dev-tool={link.isDevTool || undefined}
            className={`${styles.navButton} ${isActive ? customBorderStyles.cornerBorders : ''}`}
          >
            {icon}
          </UnstyledButton>
        ) : (
          <UnstyledButton
            component={Link}
            href={link.href}
            data-active={isActive || undefined}
            data-dev-tool={link.isDevTool || undefined}
            className={`${styles.navButton} ${isActive ? customBorderStyles.cornerBorders : ''}`}
          >
            {icon}
          </UnstyledButton>
        )}
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
            my="sm"
            w={30}
            h={30}
            radius={15}
            bg={colorScheme === 'dark' ? 'var(--mantine-color-green-6)' : ''}
          />
        </Link>
      </Tooltip>

      <Stack gap="md">
        {upperLinks
          .filter((link) => link.enabled && (isDevToolsEnabled || !link.isDevTool))
          .map((link) => {
            const isActive = link.type === 'link' && pathname.startsWith(link.href);
            return createMenuItem(link, isActive);
          })}
      </Stack>
      <Stack justify="center" mt="auto" p="xs" gap="md">
        <SignedOut>
          <SignUpButton />
        </SignedOut>
        <SignedIn>
          {lowerLinks
            .filter((link) => link.enabled && (isDevToolsEnabled || !link.isDevTool))
            .map((link) => {
              const isActive = link.type === 'link' && pathname.startsWith(link.href);
              return createMenuItem(link, isActive);
            })}
          {createMenuItem(
            {
              type: 'button',
              onClick: () => {
                const newScheme = colorScheme === 'light' ? 'dark' : 'light';
                setColorScheme(newScheme);
                trackToggleDisplayMode(newScheme);
              },
              label: 'Toggle Display Mode',
              icon: colorScheme === 'light' ? MoonIcon : SunIcon,
              iconType: 'lucide',
              enabled: true,
            },
            false,
          )}
          <Center>
            <UserButton />
          </Center>
        </SignedIn>
      </Stack>
    </Stack>
  );
}
