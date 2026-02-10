'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { Text13Regular } from '@/app/components/base/text';
import { ConfirmDialog, useConfirmDialog } from '@/app/components/modals/ConfirmDialog';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { workbookApi } from '@/lib/api/workbook';
import { notifications } from '@mantine/notifications';
import { ActionIcon, Menu, Text } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { EllipsisVertical, FileCode, GitGraph, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { GitFileBrowserModal } from '../modals/GitFileBrowserModal';
import { GitGraphModal } from '../modals/GitGraphModal';

interface DebugMenuProps {
  workbookId: WorkbookId;
}

export function DebugMenu({ workbookId }: DebugMenuProps) {
  const { isAdmin } = useScratchPadUser();
  const [gitGraphOpen, setGitGraphOpen] = useState(false);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const { open: openConfirmDialog, dialogProps } = useConfirmDialog();

  const handleResetWorkbook = () => {
    openConfirmDialog({
      title: 'Reset Workbook',
      message:
        'Are you sure you want to reset this workbook? This will delete all data folders and reset the git repository. This action cannot be undone.',
      confirmLabel: 'Reset',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await workbookApi.resetWorkbook(workbookId);
          window.location.reload();
        } catch (e) {
          notifications.show({
            title: 'Error',
            message: 'Failed to reset workbook',
            color: 'red',
          });
          console.error(e);
        }
      },
    });
  };

  return (
    <>
      <Menu shadow="md" width={200} position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray">
            <StyledLucideIcon Icon={EllipsisVertical} size="sm" />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Debug Tools</Menu.Label>
          <Menu.Item leftSection={<StyledLucideIcon Icon={GitGraph} size="sm" />} onClick={() => setGitGraphOpen(true)}>
            <Text13Regular>Git Graph</Text13Regular>
          </Menu.Item>
          <Menu.Item
            leftSection={<StyledLucideIcon Icon={FileCode} size="sm" />}
            onClick={() => setFileBrowserOpen(true)}
          >
            <Text13Regular>Git File Browser</Text13Regular>
          </Menu.Item>

          {isAdmin && (
            <>
              <Menu.Divider />
              <Menu.Label>Admin</Menu.Label>
              <Menu.Item
                color="red"
                leftSection={<StyledLucideIcon Icon={Trash2} size="sm" />}
                onClick={handleResetWorkbook}
              >
                <Text size="xs" fw={500}>
                  Reset Workbook
                </Text>
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <GitGraphModal opened={gitGraphOpen} onClose={() => setGitGraphOpen(false)} workbookId={workbookId} />

      <GitFileBrowserModal opened={fileBrowserOpen} onClose={() => setFileBrowserOpen(false)} workbookId={workbookId} />

      {/* Confirm Dialog */}
      <ConfirmDialog {...dialogProps} />
    </>
  );
}
