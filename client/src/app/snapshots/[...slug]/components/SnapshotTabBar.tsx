import { Box, Group, Menu, Tabs } from '@mantine/core';
import { EyeOff, Plus, Trash2 } from 'lucide-react';
import { useActiveSnapshot } from '../../../../hooks/use-active-snapshot';
import { NewTabId, SnapshotEditorUIState, useSnapshotEditorUIStore } from '../../../../stores/snapshot-editor-store';
import { SnapshotTableId } from '../../../../types/server-entities/ids';
import { Snapshot } from '../../../../types/server-entities/snapshot';
import { IconButtonGhost } from '../../../components/base/buttons';
import { TextSmHeavier } from '../../../components/base/text';
import { CloseButtonInline } from '../../../components/CloseButtonInline';
import { ConnectorIcon } from '../../../components/ConnectorIcon';
import classes from './SnapshotTabBar.module.css';

export const SnapshotTabBar = () => {
  const { snapshot, hideTable, deleteTable } = useActiveSnapshot();
  const tabs = useSnapshotEditorUIStore((state) => state.tabs);
  const activeTab = useSnapshotEditorUIStore((state) => state.activeTab);
  const setActiveTab = useSnapshotEditorUIStore((state) => state.setActiveTab);
  const openNewBlankTab = useSnapshotEditorUIStore((state) => state.openNewBlankTab);
  const closeTab = useSnapshotEditorUIStore((state) => state.closeTab);

  return (
    <Tabs
      classNames={classes}
      variant="pills"
      value={activeTab}
      onChange={(value) => value && setActiveTab(value as SnapshotTableId | NewTabId)}
    >
      <Tabs.List>
        {tabs.map((tab) => (
          <TableTab
            key={tab.id}
            tab={tab}
            snapshot={snapshot}
            hideTable={hideTable}
            deleteTable={deleteTable}
            closeBlankTab={closeTab}
          />
        ))}
        <Box key="new-tab-button">
          <IconButtonGhost onClick={openNewBlankTab}>
            <Plus size={16} />
          </IconButtonGhost>
        </Box>
      </Tabs.List>
    </Tabs>
  );
};

const TableTab = ({
  tab,
  snapshot,
  hideTable,
  deleteTable,
  closeBlankTab,
}: {
  tab: SnapshotEditorUIState['tabs'][number];
  snapshot: Snapshot | undefined;
  hideTable: (tableId: SnapshotTableId) => Promise<void>;
  deleteTable: (tableId: SnapshotTableId) => Promise<void>;
  closeBlankTab: (tabId: NewTabId) => void;
}) => {
  let table;
  let tabName;
  let rightSection;
  if (tab.type === 'table') {
    table = snapshot?.snapshotTables?.find((t) => t.id === tab.id);
    tabName = table ? table.tableSpec.name : 'New tab';
    rightSection = (
      <Menu>
        <Menu.Target>
          <CloseButtonInline onClick={(e) => e.stopPropagation()} />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            leftSection={<EyeOff size={14} />}
            onClick={async (e) => {
              e.stopPropagation();
              hideTable(tab.id);
            }}
          >
            Hide
          </Menu.Item>
          <Menu.Item
            leftSection={<Trash2 size={14} />}
            color="red"
            onClick={async (e) => {
              e.stopPropagation();
              deleteTable(tab.id);
            }}
          >
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    );
  } else {
    table = null;
    tabName = 'New tab';
    rightSection = (
      <CloseButtonInline
        onClick={(e) => {
          e.stopPropagation();
          closeBlankTab(tab.id);
        }}
      />
    );
  }

  return (
    <Tabs.Tab component={Box} value={tab.id} key={tab.id} rightSection={rightSection}>
      <Group gap="3" wrap="nowrap" maw={250}>
        {table && <ConnectorIcon connector={table.connectorService} size={28} />}
        <TextSmHeavier truncate="end">{tabName}</TextSmHeavier>
      </Group>
    </Tabs.Tab>
  );
};
