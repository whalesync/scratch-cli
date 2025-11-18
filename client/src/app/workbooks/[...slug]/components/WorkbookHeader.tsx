import { ToolIconButton } from '@/app/components/ToolIconButton';
import { ActionIcon, Group } from '@mantine/core';
import { PanelLeftIcon, PanelRightIcon, Table2 } from 'lucide-react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { useLayoutManagerStore } from '../../../../stores/layout-manager-store';
import { Text13Regular } from '../../../components/base/text';
import { StyledLucideIcon } from '../../../components/Icons/StyledLucideIcon';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook } = useActiveWorkbook();
  const { rightPanelOpened, toggleRightPanel, toggleNavDrawer } = useLayoutManagerStore();
  return (
    <Group bg="var(--bg-panel)" h={36} justify="space-between" pos="relative" px="xs" gap="xs">
      <ToolIconButton icon={PanelLeftIcon} onClick={toggleNavDrawer} size="md" />

      {/* Float in the middle */}
      <Group gap={6}>
        <StyledLucideIcon Icon={Table2} size={14} c="var(--fg-secondary)" />
        <Text13Regular>{workbook?.name}</Text13Regular>
      </Group>
      {/* TODO: Move the publish button here, after figuring out how it should behave */}
      {/* <ButtonSecondaryOutline size="xs" leftSection={<CloudUpload size={16} />}>
        Publish
      </ButtonSecondaryOutline> */}
      <Group gap="xs">
        <ActionIcon onClick={toggleRightPanel} variant={rightPanelOpened ? 'light' : 'subtle'}>
          <StyledLucideIcon Icon={PanelRightIcon} size="md" />
        </ActionIcon>
        <WorkbookActionsMenu />
      </Group>
    </Group>
  );
};
