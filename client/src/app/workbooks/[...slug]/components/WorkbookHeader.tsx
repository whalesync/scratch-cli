import { ButtonSecondaryInline } from '@/app/components/base/buttons';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Group } from '@mantine/core';
import { CloudUploadIcon, MessagesSquareIcon, PanelLeftIcon, Table2 } from 'lucide-react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { useLayoutManagerStore } from '../../../../stores/layout-manager-store';
import { Text13Regular } from '../../../components/base/text';
import { StyledLucideIcon } from '../../../components/Icons/StyledLucideIcon';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook } = useActiveWorkbook();
  const { toggleNavDrawer } = useLayoutManagerStore();
  const { chatOpen, openChat, openPublishConfirmation } = useWorkbookEditorUIStore();

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
        <ButtonSecondaryInline size="xs" leftSection={<CloudUploadIcon size={14} />} onClick={openPublishConfirmation}>
          Publish
        </ButtonSecondaryInline>
        <WorkbookActionsMenu />
      </Group>
    </Group>
  );
};
