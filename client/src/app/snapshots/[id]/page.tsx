'use client';

import { useSnapshot } from '@/hooks/use-snapshot';
import { useUpsertView, useViews } from '@/hooks/use-view';
import { snapshotApi } from '@/lib/api/snapshot';
import { TableSpec } from '@/types/server-entities/snapshot';
import {
  ActionIcon,
  Button,
  Center,
  CheckIcon,
  CopyButton,
  Group,
  Loader,
  Menu,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  DownloadSimpleIcon,
  HeadCircuitIcon,
  RobotIcon,
  TableIcon,
  TrashIcon,
  UploadIcon,
} from '@phosphor-icons/react';
import { useParams, useRouter } from 'next/navigation';
import AIChatPanel from '../../components/AIChatPanel';

import '@glideapps/glide-data-grid/dist/index.css';
import { useEffect, useState } from 'react';
import { useConnectorAccount } from '../../../hooks/use-connector-account';
import { TableContent } from './components/TableContent';
import { ViewList } from './components/ViewList';

export default function SnapshotPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const { snapshot, isLoading, publish } = useSnapshot(id);
  const { connectorAccount } = useConnectorAccount(snapshot?.connectorAccountId);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<TableSpec | null>(null);
  const [currentViewId, setCurrentViewId] = useState<string | null>(null);
  const [lastViewUpdate, setLastViewUpdate] = useState<number>(Date.now());

  const [showChat, setShowChat] = useState(true);

  useEffect(() => {
    if (!selectedTableId) {
      setSelectedTableId(snapshot?.tables[0].id.wsId ?? null);
      setSelectedTable(snapshot?.tables[0] ?? null);
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

    // Default to true if not specified (as per the type definition)
    const isRecordsVisible = tableConfig?.visible !== false;
    const isRecordsEditable = tableConfig?.editable !== false;

    // For tab title: show icon if set to non-default (invisible or non-editable)
    const tabIcons = [];
    if (tableConfig?.visible === false) tabIcons.push('🚫');
    if (tableConfig?.editable === false) tabIcons.push('🔒');

    const toggleRecordsVisibility = async () => {
      if (!snapshot) return;
      if (currentView) {
        const newConfig = {
          ...currentView.config,
          [table.id.wsId]: {
            ...tableConfig,
            visible: !isRecordsVisible,
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
          parentId: currentView.parentId || undefined,
          name: currentView.name || undefined,
          snapshotId: snapshot.id,
          config: newConfig,
        });

        // Revalidate to ensure consistency
        await refreshViews();

        notifications.show({
          title: 'Records Visibility Updated',
          message: `Records are now ${!isRecordsVisible ? 'visible' : 'hidden'} by default`,
          color: 'green',
        });
      } else {
        // No view: create a new view for this table
        const newConfig = {
          [table.id.wsId]: {
            visible: false,
            editable: true,
          },
        };
        const result = await upsertView({
          snapshotId: snapshot.id,
          config: newConfig,
        });
        await refreshViews();
        notifications.show({
          title: 'Records Visibility Updated',
          message: `Records are now hidden by default`,
          color: 'green',
        });
        // Select the newly created view
        onViewCreated?.(result.id);
      }
    };

    const toggleRecordsEditability = async () => {
      if (!snapshot) return;
      if (currentView) {
        const newConfig = {
          ...currentView.config,
          [table.id.wsId]: {
            ...tableConfig,
            editable: !isRecordsEditable,
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
          parentId: currentView.parentId || undefined,
          name: currentView.name || undefined,
          snapshotId: snapshot.id,
          config: newConfig,
        });

        // Revalidate to ensure consistency
        await refreshViews();

        notifications.show({
          title: 'Records Editability Updated',
          message: `Records are now ${!isRecordsEditable ? 'editable' : 'locked'} by default`,
          color: 'green',
        });
      } else {
        // No view: create a new view for this table
        const newConfig = {
          [table.id.wsId]: {
            visible: true,
            editable: false,
          },
        };
        const result = await upsertView({
          snapshotId: snapshot.id,
          config: newConfig,
        });
        await refreshViews();
        notifications.show({
          title: 'Records Editability Updated',
          message: `Records are now locked by default`,
          color: 'green',
        });
        // Select the newly created view
        onViewCreated?.(result.id);
      }
    };

    // If there is no view, default is visible/editable, so menu should offer to make invisible/non-editable
    const menuItems = [
      <Menu.Item key="visibility" leftSection={isRecordsVisible ? '🚫' : '👁️'} onClick={toggleRecordsVisibility}>
        {isRecordsVisible ? 'Make Records Hidden by Default' : 'Make Records Visible by Default'}
      </Menu.Item>,
      <Menu.Item key="editability" leftSection={isRecordsEditable ? '🔒' : '✏️'} onClick={toggleRecordsEditability}>
        {isRecordsEditable ? 'Make Records Locked by Default' : 'Make Records Editable by Default'}
      </Menu.Item>,
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
            <ViewList snapshotId={id} currentViewId={currentViewId} onViewChange={setCurrentViewId} />

            <Tabs
              value={selectedTableId}
              onChange={(value) => {
                setSelectedTableId(value);
                setSelectedTable(snapshot.tables.find((t) => t.id.wsId === value) ?? null);
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
              />
            )}
          </Stack>

          <AIChatPanel
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            snapshotId={id}
            currentViewId={currentViewId}
          />
        </Group>
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
