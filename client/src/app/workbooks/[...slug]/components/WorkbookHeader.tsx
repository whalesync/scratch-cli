import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { Text13Regular } from '@/app/components/base/text';
import { DeletedConnectionIcon } from '@/app/components/DeletedConnectionIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { hasAllConnectionsDeleted } from '@/types/server-entities/workbook';
import { Group } from '@mantine/core';
import { CloudUploadIcon, MessagesSquareIcon, PanelLeftIcon, Table2 } from 'lucide-react';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook } = useActiveWorkbook();
  const toggleNavDrawer = useLayoutManagerStore((state) => state.toggleNavDrawer);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  const openChat = useWorkbookEditorUIStore((state) => state.openChat);
  const openPublishConfirmation = useWorkbookEditorUIStore((state) => state.openPublishConfirmation);
  const allConnectionsDeleted = hasAllConnectionsDeleted(workbook);
  return (
    <Group bg="var(--bg-panel)" h={36} justify="space-between" pos="relative" px="xs" gap="xs">
      <ToolIconButton icon={PanelLeftIcon} onClick={toggleNavDrawer} size="md" />

      {/* Float in the middle */}
      <Group gap={6}>
        <StyledLucideIcon Icon={Table2} size={14} c="var(--fg-secondary)" />
        <Text13Regular>{workbook?.name}</Text13Regular>
      </Group>
      <Group gap="xs">
        {!chatOpen && (
          <ButtonSecondaryInline
            onClick={openChat}
            leftSection={<StyledLucideIcon Icon={MessagesSquareIcon} size="sm" />}
          >
            Chat
          </ButtonSecondaryInline>
        )}
        {/* TODO: Move the publish button here, after figuring out how it should behave */}
        <ButtonSecondaryInline
          disabled={allConnectionsDeleted}
          size="xs"
          leftSection={
            allConnectionsDeleted ? <DeletedConnectionIcon decorative={false} /> : <CloudUploadIcon size={14} />
          }
          onClick={openPublishConfirmation}
        >
          Publish
        </ButtonSecondaryInline>
        <WorkbookActionsMenu />
      </Group>
    </Group>
  );
};
