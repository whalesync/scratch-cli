import { IconButtonGhost } from '@/app/components/base/buttons';
import { Text13Medium } from '@/app/components/base/text';
import { CloseButtonInline } from '@/app/components/CloseButtonInline';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { DeletedConnectionIcon } from '@/app/components/Icons/DeletedConnectionIcon';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { NewTabId, useWorkbookEditorUIStore, WorkbookEditorUIState } from '@/stores/workbook-editor-store';
import { hasDeletedConnection } from '@/types/server-entities/workbook';
import { Workbook } from '@spinner/shared-types';
import { Box, Group, ScrollArea, Tabs } from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import { Plus } from 'lucide-react';
import { useRef } from 'react';
import classes from './WorkbookTabBar.module.css';

export const WORKBOOK_TAB_BAR_HEIGHT = 40;

export const WorkbookTabBar = () => {
  const { workbook, hideTable } = useActiveWorkbook();
  const tabs = useWorkbookEditorUIStore((state) => state.tabs);
  const activeTab = useWorkbookEditorUIStore((state) => state.activeTab);
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const openNewBlankTab = useWorkbookEditorUIStore((state) => state.openNewBlankTab);
  const closeTab = useWorkbookEditorUIStore((state) => state.closeTab);
  const viewportRef = useRef<HTMLDivElement>(null);

  return (
    <Group
      w="100%"
      gap={0}
      wrap="nowrap"
      style={{ backgroundColor: 'var(--bg-panel)', borderBottom: '0.5px solid var(--mantine-color-gray-4)' }}
    >
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
        w="auto"
        maw="calc(100% - 40px)"
        miw={0}
      >
        <ScrollArea
          h={WORKBOOK_TAB_BAR_HEIGHT}
          scrollbars="x"
          scrollbarSize={6}
          styles={{
            thumb: { backgroundColor: 'var(--mantine-color-gray-5)' },
          }}
          viewportRef={viewportRef}
          onWheel={(e) => {
            if (e.deltaY !== 0 && viewportRef.current) {
              viewportRef.current.scrollLeft += e.deltaY;
            }
          }}
        >
          <Tabs.List>
            {tabs.map((tab) => (
              <TableTab key={tab.id} tab={tab} workbook={workbook} hideTable={hideTable} closeBlankTab={closeTab} />
            ))}
          </Tabs.List>
        </ScrollArea>
      </Tabs>
      <Box
        key="new-tab-button"
        w={WORKBOOK_TAB_BAR_HEIGHT}
        h={WORKBOOK_TAB_BAR_HEIGHT}
        style={{
          flexShrink: 0,
          borderLeft: tabs.length > 0 ? '0.5px solid var(--mantine-color-gray-4)' : 'none',
        }}
      >
        <IconButtonGhost onClick={openNewBlankTab} h="100%">
          <Plus size={16} />
        </IconButtonGhost>
      </Box>
    </Group>
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
    const hasTables = workbook?.snapshotTables?.filter((t) => !t.hidden)?.length ?? 0 > 0;
    table = null;
    tabName = 'New tab';
    rightSection = hasTables ? (
      <CloseButtonInline
        onClick={(e) => {
          e.stopPropagation();
          closeBlankTab(tab.id);
        }}
      />
    ) : (
      <></>
    );
  }
  const tabIcon = () => {
    if (!table) {
      return <></>;
    }
    const isConnectionDeleted = hasDeletedConnection(table);
    if (isConnectionDeleted) {
      return <DeletedConnectionIcon decorative={false} />;
    }
    return <ConnectorIcon connector={table.connectorService} size={28} />;
  };
  return (
    <Tabs.Tab component={Box} value={tab.id} key={tab.id} rightSection={rightSection} h={WORKBOOK_TAB_BAR_HEIGHT}>
      <Group gap="3" wrap="nowrap" maw={250}>
        {tabIcon()}
        <Text13Medium truncate="end">{tabName}</Text13Medium>
      </Group>
    </Tabs.Tab>
  );
};
