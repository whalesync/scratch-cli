'use client';

import { RouteUrls } from '@/utils/route-urls';
import { UserButton } from '@clerk/nextjs';
import { Group, Stack, useMantineColorScheme } from '@mantine/core';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { trackToggleDisplayMode } from '@/lib/posthog';
import { DocsUrls } from '@/utils/docs-urls';
import {
  BlocksIcon,
  CircleQuestionMarkIcon,
  CpuIcon,
  FileTextIcon,
  LucideIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  Table2Icon,
} from 'lucide-react';
import { useDevTools } from '../../hooks/use-dev-tools';
import { ButtonSecondaryGhost, ButtonSecondaryOutline, DevToolButtonGhost } from './base/buttons';
import { Text13Regular } from './base/text';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

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
    href: RouteUrls.settingsPageUrl,
    label: 'Settings',
    icon: SettingsIcon,
  },
];

export function NavMenu() {
  const { user } = useScratchPadUser();

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
      <Group justify="flex-start" w="100%" align="center" gap="xs">
        <UserButton />
        <Text13Regular>{user?.name || user?.email}</Text13Regular>
      </Group>
      <Stack gap="2px" justify="flex-start" w="100%">
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
  const icon = <StyledLucideIcon Icon={item.icon} size={16} />;

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
