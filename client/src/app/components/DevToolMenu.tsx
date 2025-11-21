import { Menu } from '@mantine/core';
import { CpuIcon } from 'lucide-react';
import { useDevTools } from '../../hooks/use-dev-tools';

export function DevToolMenuItem({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}): React.ReactNode {
  const { isDevToolsEnabled } = useDevTools();
  if (!isDevToolsEnabled) {
    return null;
  }
  return (
    <Menu.Item
      onClick={onClick}
      leftSection={<CpuIcon size={16} color="var(--mantine-color-devTool-9)" />}
      c="var(--mantine-color-devTool-9)"
      disabled={disabled}
    >
      {children}
    </Menu.Item>
  );
}
