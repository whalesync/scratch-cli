'use client';

import { trackToggleDisplayMode } from '@/lib/posthog';
import { DocsUrls } from '@/utils/docs-urls';
import { RouteUrls } from '@/utils/route-urls';
import { UserButton } from '@clerk/nextjs';
import { Box, Center, Stack, useMantineColorScheme } from '@mantine/core';
import {
  BlocksIcon,
  ChevronDown,
  CircleQuestionMarkIcon,
  CpuIcon,
  CreditCardIcon,
  FileTextIcon,
  LucideIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Table2Icon,
} from 'lucide-react';
import Image from 'next/image';
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
  {
    type: 'link',
    href: RouteUrls.dataSourcesPageUrl,
    label: 'Data sources',
    icon: BlocksIcon,
  },
  {
    type: 'link',
    href: RouteUrls.promptAssetsPageUrl,
    label: 'Prompt assets',
    icon: FileTextIcon,
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
  {
    type: 'link',
    href: DocsUrls.root,
    newTab: true,
    label: 'Docs',
    icon: CircleQuestionMarkIcon,
  },
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
  return (
    <Stack h="100%" p="10px 8px" gap="10px" bg="var(--bg-panel)">
      <Stack gap="2px" justify="flex-start" w="100%">
        <NavMenuUserButton />
        {upperMenuItems
          .filter((item) => isDevToolsEnabled || !item.isDevTool)
          .map((item) => {
            const isActive = item.type === 'link' && pathname.startsWith(item.href);
            return <NavMenuItem key={item.label} item={item} isActive={isActive} />;
          })}
      </Stack>
      <Stack gap="2px" justify="flex-start" w="100%" mt="auto">
        <NavMenuItem item={colorModeItem} isActive={false} />

        {lowerMenuItems
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
  const avatar = <Image src="/logo-color.svg" alt="Scratch" width={19} height={19} className={styles.embadgedLogo} />;

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
      leftSection={avatar}
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
