import { ActionIcon, Center, Group } from '@mantine/core';
import { PanelRightIcon, Table2 } from 'lucide-react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { useLayoutManagerStore } from '../../../../stores/layout-manager-store';
import { Text13Regular } from '../../../components/base/text';
import { StyledLucideIcon } from '../../../components/Icons/StyledLucideIcon';
import { WorkbookActionsMenu } from './WorkbookActionsMenu';

export const WorkbookHeader = () => {
  const { workbook } = useActiveWorkbook();
  const { rightPanelOpened, toggleRightPanel } = useLayoutManagerStore();
  return (
    <Group bg="var(--bg-panel)" h={36} justify="flex-end" pos="relative" px="xs" gap="xs">
      {/* Float in the middle */}
      <Center pos="absolute" left={0} right={0}>
        <Group gap={6}>
          <StyledLucideIcon Icon={Table2} size={14} c="var(--fg-secondary)" />
          <Text13Regular>{workbook?.name}</Text13Regular>
        </Group>
      </Center>
      {/* TODO: Move the publish button here, after figuring out how it should behave */}
      {/* <ButtonSecondaryOutline size="xs" leftSection={<CloudUpload size={16} />}>
        Publish
      </ButtonSecondaryOutline> */}
      <ActionIcon onClick={toggleRightPanel} variant={rightPanelOpened ? 'light' : 'subtle'}>
        <StyledLucideIcon Icon={PanelRightIcon} size="md" />
      </ActionIcon>
      <WorkbookActionsMenu />
    </Group>
  );
};
