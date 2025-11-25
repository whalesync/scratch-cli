import { Box, Group, Menu, Tabs } from '@mantine/core';
import { EyeOff, Plus, Trash2 } from 'lucide-react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { NewTabId, WorkbookEditorUIState, useWorkbookEditorUIStore } from '../../../../stores/workbook-editor-store';
import { SnapshotTableId } from '../../../../types/server-entities/ids';
import { Workbook } from '../../../../types/server-entities/workbook';
import { IconButtonGhost } from '../../../components/base/buttons';
import { Text13Medium } from '../../../components/base/text';
import { CloseButtonInline } from '../../../components/CloseButtonInline';
import { ConnectorIcon } from '../../../components/ConnectorIcon';
import classes from './WorkbookTabBar.module.css';

export const WORKBOOK_TAB_BAR_HEIGHT = 40;

export const WorkbookTabBar = () => {
  const { workbook, hideTable, deleteTable } = useActiveWorkbook();
  const tabs = useWorkbookEditorUIStore((state) => state.tabs);
  const activeTab = useWorkbookEditorUIStore((state) => state.activeTab);
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const openNewBlankTab = useWorkbookEditorUIStore((state) => state.openNewBlankTab);
  const closeTab = useWorkbookEditorUIStore((state) => state.closeTab);

  return (
    <Tabs
      classNames={classes}
      h={WORKBOOK_TAB_BAR_HEIGHT}
      variant="pills"
      value={activeTab}
      onChange={(value) => value && setActiveTab(value as SnapshotTableId | NewTabId)}
    >
      <Tabs.List>
        {tabs.map((tab) => (
          <TableTab
            key={tab.id}
            tab={tab}
            workbook={workbook}
            hideTable={hideTable}
            deleteTable={deleteTable}
            closeBlankTab={closeTab}
          />
        ))}
        <Box key="new-tab-button">
          <IconButtonGhost onClick={openNewBlankTab} h="100%">
            <Plus size={16} />
          </IconButtonGhost>
        </Box>
      </Tabs.List>
    </Tabs>
  );
};

const TableTab = ({
  tab,
  workbook,
  hideTable,
  deleteTable,
  closeBlankTab,
}: {
  tab: WorkbookEditorUIState['tabs'][number];
  workbook: Workbook | undefined;
  hideTable: (tableId: SnapshotTableId) => Promise<void>;
  deleteTable: (tableId: SnapshotTableId) => Promise<void>;
  closeBlankTab: (tabId: NewTabId) => void;
}) => {
  let table;
  let tabName;
  let rightSection;
  if (tab.type === 'table') {
    table = workbook?.snapshotTables?.find((t) => t.id === tab.id);
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
            data-delete
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
        <Text13Medium truncate="end">{tabName}</Text13Medium>
      </Group>
    </Tabs.Tab>
  );
};
