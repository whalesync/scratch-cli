'use client';

import { useSnapshot } from '@/hooks/use-snapshot';
import { useUpsertView, useViews } from '@/hooks/use-view';
import { snapshotApi } from '@/lib/api/snapshot';
import { SnapshotTableContext, TableSpec } from '@/types/server-entities/snapshot';
import {
  ActionIcon,
  Button,
  Center,
  CheckIcon,
  CopyButton,
  Group,
  Loader,
  Menu,
  Modal,
  ScrollArea,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
  useModalsStack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  BugIcon,
  DownloadSimpleIcon,
  HeadCircuitIcon,
  RobotIcon,
  TableIcon,
  TrashIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import { useParams, useRouter } from 'next/navigation';
import AIChatPanel from '../../components/AIChatPanel';

import JsonTreeViewer from '@/app/components/JsonTreeViewer';
import '@glideapps/glide-data-grid/dist/index.css';
import { useEffect, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useConnectorAccount } from '../../../hooks/use-connector-account';
import { TableContent } from './components/TableContent';
import { ViewData } from './components/ViewData';

export default function SnapshotPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const { snapshot, isLoading, publish } = useSnapshot(id);
  const { connectorAccount } = useConnectorAccount(snapshot?.connectorAccountId);
  const { mutate } = useSWRConfig();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableSpec | null>(null);
  const [selectedTableContext, setSelectedTableContext] = useState<SnapshotTableContext | null>(null);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [lastViewUpdate, setLastViewUpdate] = useState<number>(Date.now());
  const [readFocus, setReadFocus] = useState<Array<{ recordWsId: string; columnWsId: string }>>([]);
  const [writeFocus, setWriteFocus] = useState<Array<{ recordWsId: string; columnWsId: string }>>([]);
  const [filterToView, setFilterToView] = useState(false);
  const [filteredRecordsCount, setFilteredRecordsCount] = useState(0);
  const modalStack = useModalsStack(['tableSpecDebug', 'tableContextDebug']);

  const [showChat, setShowChat] = useState(true);

  const handleClearFilter = async () => {
    if (!selectedTable) return;

    try {
      await snapshotApi.clearActiveRecordFilter(id, selectedTable.id.wsId);
      notifications.show({
        title: 'Filter Cleared',
        message: 'All records are now visible',
        color: 'green',
      });
      // Force immediate update of the filtered count
      setFilteredRecordsCount(0);

      // Invalidate records cache to refresh the data
      mutate((key) => Array.isArray(key) && key[0] === 'snapshot' && key[1] === 'records' && key[2] === id, undefined, {
        revalidate: true,
      });
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: 'Error clearing filter',
        message: error.message,
        color: 'red',
      });
    }
  };

  useEffect(() => {
    if (!selectedTableId) {
      setSelectedTableId(snapshot?.tables[0].id.wsId ?? null);
      setSelectedTable(snapshot?.tables[0] ?? null);
      setSelectedTableContext(snapshot?.tableContexts[0] ?? null);
    }
  }, [snapshot, selectedTableId]);

  const handleDownload = async () => {
    try {
      await snapshotApi.download(id);
      notifications.show({
        title: 'Download started',
        message: 'Your data is being downloaded from the remote source.',
        color: 'blue',
      });
    } catch (e) {
      console.error(e);
      notifications.show({
        title: 'Download failed',
        message: 'There was an error starting the download.',
        color: 'red',
      });
    }
  };

  const handlePublish = async () => {
    try {
      notifications.show({
        id: 'publish-notification', // So it gets replaced by below.
        title: 'Publishing',
        message: `Your data is being published to ${connectorAccount?.service}`,
        color: 'blue',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });
      await publish();
      notifications.update({
        id: 'publish-notification',
        title: 'Published',
        message: `Your data has been published to ${connectorAccount?.service}`,
        color: 'green',
        icon: <CheckIcon size={18} />,
        loading: false,
        autoClose: 2000,
      });
    } catch (e) {
      console.error(e);
      notifications.update({
        id: 'publish-notification',
        title: 'Publish failed',
        message: (e as Error).message ?? 'There was an error publishing your data',
        color: 'red',
        loading: false,
        autoClose: 2000,
      });
    }
  };

  const handleAbandon = async () => {
    try {
      await snapshotApi.delete(id);
      notifications.show({
        title: 'Snapshot abandoned',
        message: 'The snapshot and its data have been deleted.',
        color: 'green',
      });
      router.back();
    } catch (e) {
      console.error(e);
      notifications.show({
        title: 'Deletion failed',
        message: 'There was an error deleting the snapshot.',
        color: 'red',
      });
    }
  };

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const TableTab = ({ table, onViewCreated }: { table: TableSpec; onViewCreated?: (viewId: string) => void }) => {
    const [isHovered, setIsHovered] = useState(false);
    const { views, refreshViews } = useViews(snapshot?.id ?? '');
    const { upsertView } = useUpsertView();

    // Get current view for this table
    const currentView = views?.find((v) => v.id === currentViewId);
    const tableConfig = currentView?.config[table.id.wsId];

    // Default to false if not specified (as per the new type definition)
    const isTableHidden = tableConfig?.hidden === true;
    const isTableProtected = tableConfig?.protected === true;

    // For tab title: show icon if set to non-default (hidden or protected)
    const tabIcons = [];
    if (tableConfig?.hidden === true) tabIcons.push('🚫');
    if (tableConfig?.protected === true) tabIcons.push('🔒');

    const toggleTableVisibility = async () => {
      if (!snapshot) return;
      if (currentView) {
        const newConfig = {
          ...currentView.config,
          [table.id.wsId]: {
            ...tableConfig,
            hidden: !isTableHidden,
          },
        };

        // Optimistically update the local cache immediately
        const updatedView = { ...currentView, config: newConfig };
        const updatedViews = views?.map((v) => (v.id === currentView.id ? updatedView : v));
        refreshViews(updatedViews, false); // Update cache without revalidating

        // Force immediate re-render
        setLastViewUpdate(Date.now());

        // Then update the server
        await upsertView({
          id: currentView.id,
          name: currentView.name || undefined,
          snapshotId: snapshot.id,
          config: newConfig,
        });

        // Revalidate to ensure consistency
        await refreshViews();

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
        const result = await upsertView({
          snapshotId: snapshot.id,
          config: newConfig,
        });
        await refreshViews();
        notifications.show({
          title: 'Table Visibility Updated',
          message: 'Table is now hidden',
          color: 'green',
        });
        // Select the newly created view
        onViewCreated?.(result.id);
      }
    };

    const toggleTableProtection = async () => {
      if (!snapshot) return;
      if (currentView) {
        const newConfig = {
          ...currentView.config,
          [table.id.wsId]: {
            ...tableConfig,
            protected: !isTableProtected,
          },
        };

        // Optimistically update the local cache immediately
        const updatedView = { ...currentView, config: newConfig };
        const updatedViews = views?.map((v) => (v.id === currentView.id ? updatedView : v));
        refreshViews(updatedViews, false); // Update cache without revalidating

        // Force immediate re-render
        setLastViewUpdate(Date.now());

        // Then update the server
        await upsertView({
          id: currentView.id,
          name: currentView.name || undefined,
          snapshotId: snapshot.id,
          config: newConfig,
        });

        // Revalidate to ensure consistency
        await refreshViews();

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
        const result = await upsertView({
          snapshotId: snapshot.id,
          config: newConfig,
        });
        await refreshViews();
        notifications.show({
          title: 'Table Protection Updated',
          message: 'Table is now protected',
          color: 'green',
        });
        // Select the newly created view
        onViewCreated?.(result.id);
      }
    };

    // Menu items for configuring the Table: Hide/Unhide and Protect/Unprotect
    const menuItems = [
      <Menu.Item key="visibility" leftSection={isTableHidden ? '👁️' : '🚫'} onClick={toggleTableVisibility}>
        {isTableHidden ? 'Unhide Table' : 'Hide Table'}
      </Menu.Item>,
      <Menu.Item key="protection" leftSection={isTableProtected ? '✏️' : '🔒'} onClick={toggleTableProtection}>
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
        <Center flex={1}>
          <Text>Snapshot not found.</Text>
        </Center>
      );
    }

    if (snapshot.tables.length === 0) {
      return (
        <Center flex={1}>
          <Stack align="center">
            <TableIcon size={400} color="#55ff55" />
            <Text size="md">No tables in this snapshot.</Text>
          </Stack>
        </Center>
      );
    }

    return (
      <Stack h="100%" gap={0}>
        {/* View List Band */}

        <Group h="100%" justify="flex-start" align="flex-start" w="100%">
          <Stack h="100%" w="100%" flex={1}>
            <ViewData
              snapshotId={id}
              currentViewId={currentViewId}
              onViewChange={setCurrentViewId}
              readFocus={readFocus}
              writeFocus={writeFocus}
              onClearReadFocus={() => setReadFocus([])}
              onClearWriteFocus={() => setWriteFocus([])}
              filterToView={filterToView}
              onFilterToViewChange={setFilterToView}
              filteredRecordsCount={filteredRecordsCount}
              onClearFilter={handleClearFilter}
            />

            <Tabs
              value={selectedTableId}
              onChange={(value) => {
                setSelectedTableId(value);
                setSelectedTable(snapshot.tables.find((t) => t.id.wsId === value) ?? null);
                setSelectedTableContext(snapshot.tableContexts.find((t) => t.id.wsId === value) ?? null);
              }}
              variant="outline"
            >
              <Tabs.List px="sm" style={{ paddingRight: 0 }}>
                {snapshot.tables.map((table: TableSpec) => (
                  <Tabs.Tab value={table.id.wsId} key={`${table.id.wsId}-${currentViewId}-${lastViewUpdate}`}>
                    <TableTab table={table} onViewCreated={setCurrentViewId} />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
            {selectedTable && (
              <TableContent
                snapshot={snapshot}
                table={selectedTable}
                currentViewId={currentViewId}
                onViewCreated={setCurrentViewId}
                onFocusedCellsChange={(read, write) => {
                  setReadFocus(read);
                  setWriteFocus(write);
                }}
                filterToView={filterToView}
                onFilteredRecordsCountChange={setFilteredRecordsCount}
              />
            )}
          </Stack>

          <AIChatPanel
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            snapshotId={id}
            currentViewId={currentViewId}
            readFocus={readFocus}
            writeFocus={writeFocus}
          />
        </Group>

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
      </Stack>
    );
  };

  return (
    <Stack h="100%" gap={0}>
      <Group p="xs" bg="gray.0">
        <Group>
          <Title order={2}>{snapshot?.name ?? 'Snapshot'}</Title>
          <CopyButton value={`Connect to snapshot ${id}`} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : `Copy prompt for Cursor`} withArrow position="right">
                <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                  {copied ? <CheckIcon size={16} /> : <HeadCircuitIcon size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
        <Group ml="auto">
          <Button onClick={handleDownload} leftSection={<DownloadSimpleIcon />}>
            Download from remote
          </Button>
          <Button onClick={toggleChat} leftSection={<RobotIcon />} variant={showChat ? 'filled' : 'light'}>
            {showChat ? 'Close AI' : 'Edit with AI'}
          </Button>

          <Button variant="outline" onClick={handlePublish} leftSection={<UploadIcon />}>
            Publish
          </Button>
          <Button variant="outline" color="red" onClick={handleAbandon} leftSection={<TrashIcon />}>
            Abandon snapshot
          </Button>
        </Group>
      </Group>

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
