import { ActionIcon, Center, Group } from '@mantine/core';
import { PanelRightIcon, Table2 } from 'lucide-react';
import { useActiveSnapshot } from '../../../../hooks/use-active-snapshot';
import { useLayoutManagerStore } from '../../../../stores/layout-manager-store';
import { TextSmRegular } from '../../../components/base/text';
import { StyledLucideIcon } from '../../../components/Icons/StyledLucideIcon';
import { SnapshotActionsMenu } from './SnapshotActionsMenu';

export const SnapshotHeader = () => {
  const { snapshot } = useActiveSnapshot();
  const { rightPanelOpened, toggleRightPanel } = useLayoutManagerStore();
  return (
    <Group bg="var(--bg-panel)" h={36} justify="flex-end" pos="relative" px="xs" gap="xs">
      {/* Float in the middle */}
      <Center pos="absolute" left={0} right={0}>
        <Group gap={6}>
          <StyledLucideIcon Icon={Table2} size={14} c="var(--fg-secondary)" />
          <TextSmRegular>{snapshot?.name}</TextSmRegular>
        </Group>
      </Center>
      {/* TODO: Move the publish button here, after figuring out how it should behave */}
      {/* <ButtonSecondaryOutline size="xs" leftSection={<CloudUpload size={16} />}>
        Publish
      </ButtonSecondaryOutline> */}
      <ActionIcon onClick={toggleRightPanel} variant={rightPanelOpened ? 'light' : 'subtle'}>
        <StyledLucideIcon Icon={PanelRightIcon} size="md" />
      </ActionIcon>
      <SnapshotActionsMenu />
    </Group>
  );
};
