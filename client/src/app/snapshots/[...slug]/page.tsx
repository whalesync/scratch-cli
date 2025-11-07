'use client';

import { ActionIcon, Box, Button, Group, Menu, Tabs, Text } from '@mantine/core';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { EyeOff, PanelRightIcon, Plus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AIChatPanel from './components/AIChatPanel/AIChatPanel';

import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { TextTitle4 } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ErrorInfo } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { AgentChatContextProvider } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { SnapshotEventProvider } from '@/app/snapshots/[...slug]/components/contexts/snapshot-event-context';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { snapshotApi } from '@/lib/api/snapshot';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import '@glideapps/glide-data-grid/dist/index.css';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { useActiveSnapshot } from '../../../hooks/use-active-snapshot';
import { useSnapshotEditorUIStore } from '../../../stores/snapshot-editor-store';
import { AddTableModal } from './components/AddTableModal';
import { UpdateRecordsProvider } from './components/contexts/update-records-context';
import { ManageTablesModal } from './components/ManageTablesModal';
import { RecordDataToolbar } from './components/RecordDataToolbar';
import SnapshotGrid from './components/snapshot-grid/SnapshotGrid';
import { SnapshotActionsMenu } from './components/SnapshotActionsMenu';
import tabStyles from './components/SnapshotTableTabs.module.css';
import { useSnapshotParams } from './hooks/use-snapshot-params';

function SnapshotPageContent() {
  const { tableId, updateSnapshotPath } = useSnapshotParams();
  const { activeTable } = useActiveSnapshot();
  const setActiveTableId = useSnapshotEditorUIStore((state) => state.setActiveTableId);

  const router = useRouter();
  const { rightPanelOpened, toggleRightPanel } = useLayoutManagerStore();
  const { snapshot, isLoading, refreshSnapshot } = useActiveSnapshot();

  const [showAddTableModal, setShowAddTableModal] = useState(false);
  const [showManageTablesModal, setShowManageTablesModal] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    if (!activeTable) {
      const snapshotTables = getSnapshotTables(snapshot);
      if (tableId) {
        const table = snapshotTables.find((t) => t.tableSpec.id.wsId === tableId);
        if (table) {
          setActiveTableId(table.id);
        }
      } else if (snapshotTables.length > 0) {
        setActiveTableId(snapshotTables[0]?.id ?? null);
      }
      return;
    }

    // check to see if the content of the active table has changed and reset the object if it has, to trigger re-render of the grid
    const updatedTable = getSnapshotTables(snapshot).find((t) => t.tableSpec.id.wsId === activeTable.tableSpec.id.wsId);
    if (
      updatedTable &&
      (!_.isEqual(activeTable.tableSpec, updatedTable.tableSpec) ||
        !_.isEqual(activeTable.columnSettings, updatedTable.columnSettings))
    ) {
      // update the active table and table context with the newer version
      setActiveTableId(updatedTable.id);
    }
  }, [snapshot, activeTable, tableId, updateSnapshotPath, setActiveTableId]);

  // Temp place untill we have a better handling of hotkeys, commands,
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'p') {
        event.preventDefault();
        event.stopPropagation();
        alert('Hot key not implemented yet, use the publish button instead');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Only show loader on initial load, not during revalidation
  if (isLoading && !snapshot) {
    return <LoaderWithMessage centered message="Loading snapshot..." />;
  }

  if (!snapshot) {
    return (
      <ErrorInfo
        title="Workbook not found."
        error="We were unable to find the workbook you are looking for."
        action={
          <ButtonPrimaryLight leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.snapshotsPageUrl)}>
            Return to workbooks
          </ButtonPrimaryLight>
        }
      />
    );
  }

  if (snapshot.snapshotTables && snapshot.snapshotTables.length === 0) {
    return (
      <ErrorInfo
        title={`No tables found in ${snapshot.name}`}
        error={`There are no tables in this workbook. You will need to abandon the workbook and recreate it.`}
        action={
          <ButtonPrimaryLight leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.snapshotsPageUrl)}>
            Return to workbooks
          </ButtonPrimaryLight>
        }
      />
    );
  }

  const snapshotTables = getSnapshotTables(snapshot);
  const allTables = getSnapshotTables(snapshot, true); // Include hidden tables
  const hiddenTablesCount = allTables.filter((t) => t.hidden).length;

  const header = (
    <Group align="center" h="100%" wrap="nowrap" gap="md" style={{ width: '100%' }}>
      <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
        <TextTitle4>{snapshot.name}</TextTitle4>
      </Group>

      <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <Tabs
          value={activeTable?.id || null}
          onChange={(value) => {
            if (value) {
              const table = snapshotTables.find((t) => t.id === value);
              if (table) {
                setActiveTableId(table.id);
              }
            }
          }}
          variant="pills"
          classNames={{
            root: tabStyles.tabsRoot,
            list: tabStyles.tabsList,
            tab: tabStyles.tab,
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          <Tabs.List style={{ position: 'relative' }}>
            {snapshotTables.map((table) => (
              <div
                key={table.id}
                style={{ position: 'relative', display: 'inline-block' }}
                onMouseEnter={() => setHoveredTab(table.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <Tabs.Tab value={table.id}>
                  <Group gap="xs" wrap="nowrap">
                    <ConnectorIcon connector={table.connectorService} size={20} />
                    <Text>{table.tableSpec.name}</Text>
                    <Box w={10}>{/** spacer to make the tab wider to add space for the hover menu */}</Box>
                  </Group>
                </Tabs.Tab>
                {hoveredTab === table.id && (
                  <Menu position="bottom-end" withinPortal>
                    <Menu.Target>
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        // color="gray"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        style={{
                          position: 'absolute',
                          right: 5,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          zIndex: 10,
                          backgroundColor: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-9))',
                          border: '1px solid var(--mantine-color-gray-3)',
                        }}
                      >
                        <X size={12} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<EyeOff size={14} />}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!snapshot || !refreshSnapshot) return;
                          await snapshotApi.hideTable(snapshot.id, table.id, true);
                          await refreshSnapshot();
                        }}
                      >
                        Hide
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<Trash2 size={14} />}
                        color="red"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!snapshot || !refreshSnapshot) return;
                          if (confirm(`Delete table "${table.tableSpec.name}"? This cannot be undone.`)) {
                            await snapshotApi.deleteTable(snapshot.id, table.id);
                            await refreshSnapshot();
                          }
                        }}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </div>
            ))}
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              className={tabStyles.addButton}
              onClick={() => setShowAddTableModal(true)}
              title="Add table from another source"
            >
              <Plus size={16} />
            </ActionIcon>
          </Tabs.List>
        </Tabs>

        {hiddenTablesCount > 0 && (
          <Button
            variant="subtle"
            size="sm"
            color="gray"
            onClick={() => setShowManageTablesModal(true)}
            title={`${hiddenTablesCount} hidden table${hiddenTablesCount > 1 ? 's' : ''}`}
            style={{ flexShrink: 0 }}
          >
            <span style={{ fontSize: '12px', color: 'var(--mantine-color-dimmed)' }}>({hiddenTablesCount} hidden)</span>
          </Button>
        )}
      </Group>

      <Group gap="xs" align="center" wrap="nowrap" style={{ flexShrink: 0 }}>
        <SnapshotActionsMenu />
        {!rightPanelOpened && (
          <ActionIcon variant="transparent-hover" onClick={toggleRightPanel} color="gray">
            <StyledLucideIcon Icon={PanelRightIcon} size={14} />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );

  const aiChatPanel = activeTable ? <AIChatPanel activeTable={activeTable} /> : null;

  let content = null;
  let contentFooter = null;
  if (snapshot && activeTable) {
    content = <SnapshotGrid snapshot={snapshot} table={activeTable} />;
    contentFooter = <RecordDataToolbar table={activeTable.tableSpec} />;
  }

  return (
    <PageLayout pageTitle={snapshot.name ?? 'Workbook'} rightPanel={aiChatPanel}>
      <MainContent>
        <MainContent.Header>{header}</MainContent.Header>
        <MainContent.Body p="0">{content}</MainContent.Body>
        {contentFooter && <MainContent.Footer>{contentFooter}</MainContent.Footer>}
      </MainContent>

      <AddTableModal
        isOpen={showAddTableModal}
        onClose={() => setShowAddTableModal(false)}
        snapshotId={snapshot.id}
        onTableAdded={async () => {
          // Refresh the snapshot to show the new table
          if (refreshSnapshot) {
            await refreshSnapshot();
          }
        }}
      />

      <ManageTablesModal
        isOpen={showManageTablesModal}
        onClose={() => setShowManageTablesModal(false)}
        onSave={async () => {
          if (refreshSnapshot) {
            await refreshSnapshot();
          }
        }}
        snapshotId={snapshot.id}
        tables={allTables}
      />
    </PageLayout>
  );
}

export default function SnapshotPage() {
  const params = useSnapshotParams();

  // Top level logic for managing the snapshot editor UI state.
  const openSnapshot = useSnapshotEditorUIStore((state) => state.openSnapshot);
  const closeSnapshot = useSnapshotEditorUIStore((state) => state.closeSnapshot);
  useEffect(() => {
    openSnapshot(params);
    return () => closeSnapshot();
  }, [params, openSnapshot, closeSnapshot]);

  return (
    <AgentChatContextProvider snapshotId={params.snapshotId}>
      <SnapshotEventProvider snapshotId={params.snapshotId}>
        <AIAgentSessionManagerProvider snapshotId={params.snapshotId}>
          <UpdateRecordsProvider>
            <SnapshotPageContent />
          </UpdateRecordsProvider>
        </AIAgentSessionManagerProvider>
      </SnapshotEventProvider>
    </AgentChatContextProvider>
  );
}
