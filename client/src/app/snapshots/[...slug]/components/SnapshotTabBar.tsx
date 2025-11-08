import { Box, Group, Menu, Tabs } from '@mantine/core';
import { EyeOff, Plus, Trash2 } from 'lucide-react';
import { useActiveSnapshot } from '../../../../hooks/use-active-snapshot';
import { SnapshotEditorUIState, useSnapshotEditorUIStore } from '../../../../stores/snapshot-editor-store';
import { Snapshot } from '../../../../types/server-entities/snapshot';
import { IconButtonGhost } from '../../../components/base/buttons';
import { TextSmHeavier } from '../../../components/base/text';
import { CloseButtonInline } from '../../../components/CloseButtonInline';
import { ConnectorIcon } from '../../../components/ConnectorIcon';
import classes from './SnapshotTabBar.module.css';

export const SnapshotTabBar = ({ showAddTableModal }: { showAddTableModal: () => void }) => {
  const { snapshot, hideTable, deleteTable } = useActiveSnapshot();
  const tabs = useSnapshotEditorUIStore((state) => state.tabs);
  const activeTableId = useSnapshotEditorUIStore((state) => state.activeTableId);
  const setActiveTableId = useSnapshotEditorUIStore((state) => state.setActiveTableId);

  return (
    <Tabs
      classNames={classes}
      variant="pills"
      value={activeTableId ?? null}
      onChange={(value) => value && setActiveTableId(value)}
    >
      <Tabs.List>
        {tabs.map((tab) => (
          <TableTab key={tab.tableId} tab={tab} snapshot={snapshot} hideTable={hideTable} deleteTable={deleteTable} />
        ))}
        <IconButtonGhost onClick={() => showAddTableModal()} classNames={{ root: classes.addButton }}>
          <Plus size={16} />
        </IconButtonGhost>
      </Tabs.List>
    </Tabs>
  );
};

const TableTab = ({
  tab,
  snapshot,
  hideTable,
  deleteTable,
}: {
  tab: SnapshotEditorUIState['tabs'][number];
  snapshot: Snapshot | undefined;
  hideTable: (tableId: string) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;
}) => {
  const table = snapshot?.snapshotTables?.find((t) => t.id === tab.tableId);
  if (!table) {
    return null;
  }
  return (
    <Tabs.Tab
      component={Box}
      value={tab.tableId}
      key={tab.tableId}
      rightSection={
        <Menu>
          <Menu.Target>
            <CloseButtonInline onClick={(e) => e.stopPropagation()} />
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<EyeOff size={14} />}
              onClick={async (e) => {
                e.stopPropagation();
                hideTable(table.id);
              }}
            >
              Hide
            </Menu.Item>
            <Menu.Item
              leftSection={<Trash2 size={14} />}
              color="red"
              onClick={async (e) => {
                e.stopPropagation();
                deleteTable(table.id);
              }}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      }
    >
      <Group gap="3" wrap="nowrap" maw={250}>
        <ConnectorIcon connector={table.connectorService} size={28} />
        <TextSmHeavier truncate="end">{table.tableSpec.name}</TextSmHeavier>
      </Group>
    </Tabs.Tab>
  );
};
