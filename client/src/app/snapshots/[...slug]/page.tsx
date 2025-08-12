'use client';

import { SnapshotProvider, useSnapshotContext } from '@/app/snapshots/[...slug]/SnapshotContext';
import { SnapshotTableContext, TableSpec } from '@/types/server-entities/snapshot';
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  useModalsStack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeftIcon, BugIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import AIChatPanel from '../../components/AIChatPanel';

import { PrimaryButton } from '@/app/components/base/buttons';
import { ErrorInfo } from '@/app/components/InfoPanel';
import JsonTreeViewer from '@/app/components/JsonTreeViewer';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { SnapshotEventProvider } from '@/contexts/snapshot-event-context';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot';
import { RouteUrls } from '@/utils/route-urls';
import '@glideapps/glide-data-grid/dist/index.css';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { AIPromptProvider } from './AIPromptContext';
import { SnapshotActionsMenu } from './components/SnapshotActionsMenu';
import { TableContent } from './components/TableContent';
import { ViewData } from './components/ViewData';
import { FocusedCellsProvider } from './FocusedCellsContext';
import { useSnapshotParams } from './hooks/use-snapshot-params';
import { ICONS } from './icons';

function SnapshotPageContent() {
  const { snapshotId: id, tableId, updateSnapshotPath } = useSnapshotParams();
  const router = useRouter();

  const { snapshot, isLoading, currentViewId, setCurrentViewId } = useSnapshotContext();
  const [showChat, { toggle: toggleChat }] = useDisclosure(true);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableSpec | null>(null);
  const [selectedTableContext, setSelectedTableContext] = useState<SnapshotTableContext | null>(null);
  const [lastViewUpdate, setLastViewUpdate] = useState<number>(Date.now());
  const [filterToView, setFilterToView] = useState(false);
  const modalStack = useModalsStack(['tableSpecDebug', 'tableContextDebug', 'snapshotEventLog']);

  // Get count information for the current table
  const { count, filteredCount } = useSnapshotTableRecords({
    snapshotId: id,
    tableId: selectedTableId || '',
    viewId: filterToView && currentViewId ? currentViewId : undefined,
  });

  useEffect(() => {
    if (!selectedTableId) {
      if (tableId) {
        const table = snapshot?.tables.find((t) => t.id.wsId === tableId);
        if (table) {
          setSelectedTableId(table.id.wsId);
          setSelectedTable(table);
          setSelectedTableContext(snapshot?.tableContexts.find((t) => t.id.wsId === tableId) ?? null);
        }
      } else {
        setSelectedTableId(snapshot?.tables[0].id.wsId ?? null);
        setSelectedTable(snapshot?.tables[0] ?? null);
        setSelectedTableContext(snapshot?.tableContexts[0] ?? null);
      }
    }
  }, [snapshot, selectedTableId, tableId, updateSnapshotPath]);

  const TableTab = ({ table }: { table: TableSpec }) => {
    const [isHovered, setIsHovered] = useState(false);
    const { refreshViews, createView, setCurrentViewId, currentView, updateTableInCurrentView } = useSnapshotContext();

    // Get current view for this table
    const tableConfig = currentView?.config[table.id.wsId];

    // Default to false if not specified (as per the new type definition)
    const isTableHidden = tableConfig?.hidden === true;
    const isTableProtected = tableConfig?.protected === true;

    // For tab title: show icon if set to non-default (hidden or protected)
    const tabIcons = [];
    if (tableConfig?.hidden === true) tabIcons.push(ICONS.hidden);
    if (tableConfig?.protected === true) tabIcons.push(ICONS.protected);

    const toggleTableVisibility = async () => {
      if (!snapshot) return;
      if (currentView) {
        const newTableConfig = {
          ...tableConfig,
          hidden: !isTableHidden,
        };

        // Force immediate re-render
        setLastViewUpdate(Date.now());

        // Update the table in the current view
        await updateTableInCurrentView(table.id.wsId, newTableConfig);

        notifications.show({
          title: 'Table Visibility Updated',
          message: `Table is now ${!isTableHidden ? 'hidden' : 'visible'}`,
          color: 'green',
        });
      } else {
        // No view: create a new view for this table
        const newConfig = {
          [table.id.wsId]: {
            hidden: true,
            protected: false,
          },
        };
        const viewId = await createView(newConfig);
        await refreshViews?.();
        notifications.show({
          title: 'Table Visibility Updated',
          message: 'Table is now hidden',
          color: 'green',
        });
        // Select the newly created view
        setCurrentViewId(viewId);
      }
    };

    const toggleTableProtection = async () => {
      if (!snapshot) return;
      if (currentView) {
        const newTableConfig = {
          ...tableConfig,
          protected: !isTableProtected,
        };

        // Force immediate re-render
        setLastViewUpdate(Date.now());

        // Update the table in the current view
        await updateTableInCurrentView(table.id.wsId, newTableConfig);

        notifications.show({
          title: 'Table Protection Updated',
          message: `Table is now ${!isTableProtected ? 'protected' : 'editable'}`,
          color: 'green',
        });
      } else {
        // No view: create a new view for this table
        const newConfig = {
          [table.id.wsId]: {
            hidden: false,
            protected: true,
          },
        };
        const viewId = await createView(newConfig);
        await refreshViews?.();
        notifications.show({
          title: 'Table Protection Updated',
          message: 'Table is now protected',
          color: 'green',
        });
        // Select the newly created view
        setCurrentViewId(viewId);
      }
    };

    // Menu items for configuring the Table: Hide/Unhide and Protect/Unprotect
    const menuItems = [
      <Menu.Item
        key="visibility"
        leftSection={isTableHidden ? ICONS.visible : ICONS.hidden}
        onClick={toggleTableVisibility}
      >
        {isTableHidden ? 'Unhide Table' : 'Hide Table'}
      </Menu.Item>,
      <Menu.Item
        key="protection"
        leftSection={isTableProtected ? ICONS.editable : ICONS.protected}
        onClick={toggleTableProtection}
      >
        {isTableProtected ? 'Unprotect Table' : 'Protect Table'}
      </Menu.Item>,
      <Menu.Sub key="debug">
        <Menu.Sub.Target>
          <Menu.Sub.Item key="debug" leftSection={<BugIcon />}>
            Debug
          </Menu.Sub.Item>
        </Menu.Sub.Target>
        <Menu.Sub.Dropdown>
          <Menu.Item key="tableSpecDebug" onClick={() => modalStack.open('tableSpecDebug')}>
            View spec
          </Menu.Item>
          <Menu.Item key="tableContextDebug" onClick={() => modalStack.open('tableContextDebug')}>
            View context
          </Menu.Item>
        </Menu.Sub.Dropdown>
      </Menu.Sub>,
    ];

    return (
      <Group
        gap="xs"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{ position: 'relative' }}
      >
        <Text>
          {table.name} {tabIcons.length > 0 && <span style={{ marginLeft: 2 }}>{tabIcons.join(' ')}</span>}
        </Text>
        <Menu shadow="md" width={240}>
          <Menu.Target>
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              onClick={(e) => e.stopPropagation()}
              component="div"
              style={{
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.2s ease',
                visibility: 'visible',
              }}
            >
              <span role="img" aria-label="menu">
                ⋯
              </span>
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>{menuItems}</Menu.Dropdown>
        </Menu>
      </Group>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Center flex={1}>
          <Loader />
        </Center>
      );
    }

    if (!snapshot) {
      return (
        <ErrorInfo
          title="Snapshot not found."
          error="We were unable to find the snapshot you are looking for."
          action={
            <PrimaryButton leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.snapshotsPageUrl)}>
              Return to snapshots
            </PrimaryButton>
          }
        />
      );
    }

    if (snapshot.tables.length === 0) {
      return (
        <ErrorInfo
          title="No tables found"
          error="There are no tables in this snapshot. You will need to abandon the snapshot and recreate it."
          action={
            <PrimaryButton leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.snapshotsPageUrl)}>
              Return to snapshots
            </PrimaryButton>
          }
        />
      );
    }

    const modals = (
      <>
        {selectedTable && (
          <Modal {...modalStack.register('tableSpecDebug')} title={`TableSpec for ${selectedTable?.name}`} size="lg">
            <ScrollArea h={500}>
              <JsonTreeViewer jsonData={selectedTable} />
            </ScrollArea>
          </Modal>
        )}
        {selectedTable && (
          <Modal
            {...modalStack.register('tableContextDebug')}
            title={`Table Context settings for ${selectedTable?.name}`}
            size="lg"
          >
            <ScrollArea h={500}>
              <JsonTreeViewer jsonData={selectedTableContext ?? {}} />
            </ScrollArea>
          </Modal>
        )}
      </>
    );

    return (
      <>
        <Group h="100%" justify="flex-start" align="flex-start" w="100%" gap={0}>
          <Stack h="100%" w="70%" flex={1} gap={0}>
            <Tabs
              h="50px"
              value={selectedTableId}
              onChange={(value) => {
                setSelectedTableId(value);
                setSelectedTable(snapshot.tables.find((t) => t.id.wsId === value) ?? null);
                setSelectedTableContext(snapshot.tableContexts.find((t) => t.id.wsId === value) ?? null);
                updateSnapshotPath(snapshot.id, value ?? undefined);
              }}
              variant="default"
            >
              <Group>
                <Tabs.List px="sm" styles={{ list: { flex: 1, lineHeight: 0, borderBottom: '2px solid transparent' } }}>
                  {snapshot.tables.map((table: TableSpec) => (
                    <Tabs.Tab value={table.id.wsId} key={`${table.id.wsId}-${currentViewId}-${lastViewUpdate}`}>
                      <TableTab table={table} />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
                <Box ml="auto">
                  <SnapshotActionsMenu aiChatOpen={showChat} onChatToggle={toggleChat} />
                </Box>
              </Group>
            </Tabs>
            {selectedTable && (
              <TableContent table={selectedTable} currentViewId={currentViewId} filterToView={filterToView} />
            )}
            <ViewData
              currentViewId={currentViewId}
              onViewChange={setCurrentViewId}
              filterToView={filterToView}
              onFilterToViewChange={setFilterToView}
              currentTableId={selectedTableId}
              count={count}
              filteredCount={filteredCount}
            />
          </Stack>

          <AIChatPanel isOpen={showChat} onClose={toggleChat} activeTable={selectedTable} />
        </Group>
        {modals}
      </>
    );
  };

  return (
    <Stack h="100%" gap={0}>
      <Group gap={0} h="100%">
        {/* Main content area */}
        <div
          style={{
            width: '100%',
            height: '100%',
            transition: 'width 0.3s ease',
          }}
        >
          {renderContent()}
        </div>
      </Group>
    </Stack>
  );
}

export default function SnapshotPage() {
  const { snapshotId: id } = useSnapshotParams();

  return (
    <SnapshotProvider snapshotId={id}>
      <SnapshotEventProvider snapshotId={id}>
        <FocusedCellsProvider>
          <AIPromptProvider>
            <AIAgentSessionManagerProvider>
              <SnapshotPageContent />
            </AIAgentSessionManagerProvider>
          </AIPromptProvider>
        </FocusedCellsProvider>
      </SnapshotEventProvider>
    </SnapshotProvider>
  );
}
