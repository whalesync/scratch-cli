import { ActionIcon, Popover } from '@mantine/core';
import { BugIcon } from 'lucide-react';

import { ReactNode } from 'react';
import { useDevTools } from '../../hooks/use-dev-tools';

export const DevToolPopover = ({ children }: { children: ReactNode }): ReactNode => {
  const { isDevToolsEnabled } = useDevTools();
  if (!isDevToolsEnabled) {
    return null;
  }
  return (
    <Popover width={'wrap-content'} withArrow={false}>
      <Popover.Target>
        <ActionIcon color="var(--mantine-color-devTool-9)" variant="outline" size="sm">
          <BugIcon size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown bd="1px dashed var(--mantine-color-devTool-9)" c="var(--mantine-color-devTool-9)">
        {children}
      </Popover.Dropdown>
    </Popover>
  );
};
