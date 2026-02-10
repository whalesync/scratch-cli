'use client';

import { Box, Menu } from '@mantine/core';
import type { LucideIcon } from 'lucide-react';
import { isValidElement } from 'react';

export interface ContextMenuItem {
  type?: 'item' | 'divider';
  label?: string;
  onClick?: () => void;
  color?: string;
  disabled?: boolean;
  icon?: LucideIcon | React.ReactNode;
  delete?: boolean;
}

interface ContextMenuProps {
  opened: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  items: ContextMenuItem[];
}

function renderIcon(icon: LucideIcon | React.ReactNode | undefined) {
  if (!icon) return undefined;

  // Check if it's already a React element (already rendered JSX)
  if (isValidElement(icon)) {
    return icon;
  }

  // Otherwise assume it's a component (function or forwardRef) and render it
  const Icon = icon as LucideIcon;
  return <Icon size={16} />;
}

export function ContextMenu({ opened, onClose, position, items }: ContextMenuProps) {
  return (
    <Menu opened={opened} onChange={(o) => !o && onClose()} position="bottom-start" withinPortal>
      <Menu.Target>
        <Box
          style={{
            position: 'fixed',
            top: position.y,
            left: position.x,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}
        />
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item, index) => {
          if (item.type === 'divider') {
            return <Menu.Divider key={index} />;
          }
          return (
            <Menu.Item
              key={index}
              leftSection={renderIcon(item.icon)}
              disabled={item.disabled}
              data-delete={item.delete || undefined}
              onClick={() => {
                item.onClick?.();
                onClose();
              }}
            >
              {item.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}
