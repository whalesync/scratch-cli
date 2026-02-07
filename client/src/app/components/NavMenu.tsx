'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { trackToggleDisplayMode } from '@/lib/posthog';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { RouteUrls } from '@/utils/route-urls';
import { UserButton } from '@clerk/nextjs';
import { Box, Center, Stack, useMantineColorScheme } from '@mantine/core';
import {
  BugIcon,
  ChevronDown,
  CpuIcon,
  CreditCardIcon,
  LucideIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Table2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDevTools } from '../../hooks/use-dev-tools';
import { ButtonSecondaryGhost, ButtonSecondaryOutline, DevToolButtonGhost } from './base/buttons';
import { Text13Regular } from './base/text';
import styles from './NavMenu.module.css';

type MenuItem = {
  label: string;
  icon: LucideIcon;
  isDevTool?: boolean;
} & ({ type: 'link'; href: string; newTab?: boolean } | { type: 'button'; onClick: () => void });

const upperMenuItems: MenuItem[] = [
  {
    type: 'link',
    href: RouteUrls.workbooksPageUrl,
    label: 'Workbooks',
    icon: Table2Icon,
  },
];

const lowerMenuItems: MenuItem[] = [
  {
    type: 'link',
    href: RouteUrls.devToolsPageUrl,
    label: 'Dev Tools',
    icon: CpuIcon,

    isDevTool: true,
  },
  // Disabled until we have some content on the docs site.
  // {
  //   type: 'link',
  //   href: DocsUrls.root,
  //   newTab: true,
  //   label: 'Docs',
  //   icon: CircleQuestionMarkIcon,
  // },
  {
    type: 'link',
    href: RouteUrls.billingPageUrl,
    label: 'Billing',
    icon: CreditCardIcon,
  },
  {
    type: 'link',
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: SettingsIcon,
  },
];

export function NavMenu() {
  const pathname = usePathname();
  const openReportABugModal = useLayoutManagerStore((state) => state.openReportABugModal);
  const { user } = useScratchPadUser();
  const { isDevToolsEnabled } = useDevTools();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const colorModeItem: MenuItem = {
    type: 'button',
    onClick: () => {
      const newScheme = colorScheme === 'light' ? 'dark' : 'light';
      setColorScheme(newScheme);
      trackToggleDisplayMode(newScheme);
    },
    label: colorScheme === 'light' ? 'Dark mode' : 'Light mode',
    icon: colorScheme === 'light' ? MoonIcon : SunIcon,
  };

  const upperSectionMenuItems: MenuItem[] = upperMenuItems;

  const lowerSectionMenuItems: MenuItem[] = user?.experimentalFlags?.ENABLE_CREATE_BUG_REPORT
    ? [
        {
          type: 'button',
          onClick: openReportABugModal,
          label: 'Report a Bug',
          icon: BugIcon,
        },
        ...lowerMenuItems,
      ]
    : lowerMenuItems;

  return (
    <Stack h="100%" p="10px 8px" gap="10px" bg="var(--bg-panel)">
      <Stack gap="2px" justify="flex-start" w="100%">
        <NavMenuUserButton />
        {upperSectionMenuItems
          .filter((item) => isDevToolsEnabled || !item.isDevTool)
          .map((item) => {
            const isActive = item.type === 'link' && pathname.startsWith(item.href);
            return <NavMenuItem key={item.label} item={item} isActive={isActive} />;
          })}
      </Stack>
      <Stack gap="2px" justify="flex-start" w="100%" mt="auto">
        <NavMenuItem item={colorModeItem} isActive={false} />

        {lowerSectionMenuItems
          .filter((item) => isDevToolsEnabled || !item.isDevTool)
          .map((item) => {
            const isActive = item.type === 'link' && pathname.startsWith(item.href);
            return <NavMenuItem key={item.label} item={item} isActive={isActive} />;
          })}
      </Stack>
    </Stack>
  );
}

const NavMenuItem = ({ item, isActive }: { item: MenuItem; isActive: boolean }) => {
  const icon = (
    <Center w={19}>
      <item.icon size={13} color="var(--mantine-color-gray-7)" />
    </Center>
  );

  const ButtonComponent = item.isDevTool
    ? DevToolButtonGhost
    : isActive
      ? ButtonSecondaryOutline
      : ButtonSecondaryGhost;

  return item.type === 'button' ? (
    <ButtonComponent onClick={item.onClick} leftSection={icon} justify="flex-start">
      {item.label}
    </ButtonComponent>
  ) : (
    <ButtonComponent
      component={Link}
      href={item.href}
      data-active={isActive || undefined}
      data-dev-tool={item.isDevTool || undefined}
      leftSection={icon}
      justify="flex-start"
      target={item.newTab ? '_blank' : undefined}
      rel={item.newTab ? 'noopener noreferrer' : undefined}
    >
      {item.label}
    </ButtonComponent>
  );
};

const NavMenuUserButton = () => {
  // Overlay UserButton to make the whole area clickable and trigger the menu
  const userButtonOverlay = (
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
  );

  return (
    <ButtonSecondaryGhost
      justify="flex-start"
      fullWidth
      leftSection={
        <Box w={21} h={21} bg="#9BF9EB">
          <Box className={styles.embadgedLogo} />
        </Box>
      }
      rightSection={<ChevronDown size={16} color="var(--mantine-color-gray-7)" />}
      mb={12}
    >
      <Text13Regular style={{ color: 'var(--fg-primary)' }} truncate>
        Scratch
      </Text13Regular>
      {userButtonOverlay}
    </ButtonSecondaryGhost>
  );
};
