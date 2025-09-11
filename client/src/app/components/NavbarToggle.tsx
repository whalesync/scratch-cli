import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { ActionIcon } from '@mantine/core';
import { SidebarSimpleIcon } from '@phosphor-icons/react';

export const NavToggle = () => {
  const { toggleNavbar } = useLayoutManagerStore();

  const button = (
    <ActionIcon variant="transparent" onClick={toggleNavbar}>
      <SidebarSimpleIcon size={16} color="gray.10" />
    </ActionIcon>
  );
  return button;
};
