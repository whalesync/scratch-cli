import { IconButtonGhost } from '@/app/components/base/buttons';
import { Text13Medium } from '@/app/components/base/text';
import { CloseButtonInline } from '@/app/components/CloseButtonInline';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { DeletedConnectionIcon } from '@/app/components/DeletedConnectionIcon';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { NewTabId, useWorkbookEditorUIStore, WorkbookEditorUIState } from '@/stores/workbook-editor-store';
import { hasDeletedConnection, Workbook } from '@/types/server-entities/workbook';
import { Box, Group, Tabs } from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import { Plus } from 'lucide-react';
import classes from './WorkbookTabBar.module.css';

export const WORKBOOK_TAB_BAR_HEIGHT = 40;

export const WorkbookTabBar = () => {
  const { workbook, hideTable } = useActiveWorkbook();
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
      onChange={(value) => {
        if (value) {
          setActiveTab(value as SnapshotTableId | NewTabId);
        }
      }}
    >
      <Tabs.List>
        {tabs.map((tab) => (
          <TableTab key={tab.id} tab={tab} workbook={workbook} hideTable={hideTable} closeBlankTab={closeTab} />
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
  closeBlankTab,
}: {
  tab: WorkbookEditorUIState['tabs'][number];
  workbook: Workbook | undefined;
  hideTable: (tableId: SnapshotTableId) => Promise<void>;
  closeBlankTab: (tabId: NewTabId) => void;
}) => {
  let table;
  let tabName;
  let rightSection;
  if (tab.type === 'table') {
    table = workbook?.snapshotTables?.find((t) => t.id === tab.id);
    tabName = table ? table.tableSpec.name : 'New tab';
    rightSection = (
      <CloseButtonInline
        onClick={(e) => {
          e.stopPropagation();
          hideTable(tab.id);
        }}
      />
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
  const tabIcon = () => {
    if (!table) {
      return <></>;
    }
    const isConnectionDeleted = hasDeletedConnection(table);
    if (isConnectionDeleted) {
      return <DeletedConnectionIcon />;
    }
    return <ConnectorIcon connector={table.connectorService} size={28} />;
  };
  return (
    <Tabs.Tab component={Box} value={tab.id} key={tab.id} rightSection={rightSection}>
      <Group gap="3" wrap="nowrap" maw={250}>
        {tabIcon()}
        <Text13Medium truncate="end">{tabName}</Text13Medium>
      </Group>
    </Tabs.Tab>
  );
};
