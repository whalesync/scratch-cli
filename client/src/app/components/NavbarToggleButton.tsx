import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { ActionIcon } from '@mantine/core';
import { SidebarSimpleIcon } from '@phosphor-icons/react';
import { JSX } from 'react';
import { StyledLucideIcon } from './Icons/StyledLucideIcon';

export const NavbarToggleButton = (): JSX.Element => {
  const { toggleNavbar } = useLayoutManagerStore();

  return (
    <ActionIcon variant="transparent-hover" onClick={toggleNavbar} color="gray">
      <StyledLucideIcon Icon={SidebarSimpleIcon} size={16} />
    </ActionIcon>
  );
};
