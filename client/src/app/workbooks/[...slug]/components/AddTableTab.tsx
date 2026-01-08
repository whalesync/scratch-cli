'use client';

import { ButtonSecondaryOutline, ButtonWithDescription, IconButtonInline } from '@/app/components/base/buttons';
import { Text13Book, Text13Medium, Text13Regular, TextMono12Regular } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import {
  GenericDeleteConfirmationModal,
  useDeleteConfirmationModal,
} from '@/app/components/modals/GenericDeleteConfirmationModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAllTables } from '@/hooks/use-all-tables';
import { useOnboardingUpdate } from '@/hooks/useOnboardingUpdate';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { TableGroup } from '@/types/server-entities/table-list';
import { timeAgo } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import {
  Center,
  Divider,
  Group,
  Loader,
  RenderTreeNodePayload,
  ScrollArea,
  Stack,
  TextInput,
  Tree,
  TreeNodeData,
  useModalsStack,
  useTree,
} from '@mantine/core';
import { EntityId, Service, SnapshotTable, SnapshotTableId } from '@spinner/shared-types';
import cx from 'classnames';
import {
  ArrowRightIcon,
  ChevronDown,
  ChevronRight,
  CloudDownload,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { DecorativeBoxedIcon } from '../../../components/Icons/DecorativeBoxedIcon';
import { UploadFileModal } from '../../../components/modals/UploadFileModal';
import { CreateConnectionModal } from '../../../data-sources/components/CreateConnectionModal';
import styles from './AddTableTab.module.css';

// Helper to find matching snapshot table by comparing EntityIds
const findMatchingSnapshotTable = (
  tableId: EntityId,
  snapshotTables: SnapshotTable[] | undefined,
): SnapshotTable | undefined => {
  if (!snapshotTables) return undefined;
  return snapshotTables.find((st) => st.tableSpec.id.remoteId.every((r) => tableId.remoteId.includes(r)));
};

function createGroupKey(group: TableGroup) {
  return `${group.service}-${group.connectorAccountId ?? ''}`;
}

export const AddTableTab = () => {
  const { workbook, addTable, addSampleTable, unhideTable, deleteTable } = useActiveWorkbook();
  // const { uploads, isLoading: loadingUploads, mutate: mutateUploads } = useUploads();
  const { tables: tableGroups, isLoading: loadingTables, mutate: mutateAllTables } = useAllTables();
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const closeNewTabs = useWorkbookEditorUIStore((state) => state.closeNewTabs);
  const deleteTableModal = useDeleteConfirmationModal<SnapshotTableId>();
  const modalStack = useModalsStack(['create', 'upload']);
  const { markStepCompleted } = useOnboardingUpdate();
  const workbookMode = useWorkbookEditorUIStore((state) => state.workbookMode);
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const closeFileTab = useWorkbookEditorUIStore((state) => state.closeFileTab);

  const tree = useTree();

  const [searchQuery, setSearchQuery] = useState('');
  // const [selectedTableId, setSelectedTableId] = useState<EntityId | null>(null);
  const [refreshingGroups, setRefreshingGroups] = useState<Record<string, boolean>>({});
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  // Transform CSV uploads into a TableGroup
  // https://linear.app/whalesync/issue/DEV-9228/remove-some-unused-ui
  // const csvGroup = useMemo((): TableGroup | null => {
  //   const csvUploads = uploads.filter((upload) => upload.type === 'CSV');
  //   if (csvUploads.length === 0) return null;

  //   return {
  //     service: Service.CSV,
  //     connectorAccountId: null,
  //     displayName: 'Uploaded files',
  //     tables: csvUploads.map((upload) => ({
  //       id: {
  //         wsId: upload.id,
  //         remoteId: [upload.id],
  //       },
  //       displayName: upload.name,
  //     })),
  //   };
  // }, [uploads]);

  // Adjust the tree expansion in response to the search query
  useEffect(() => {
    if (searchQuery.length > 0) {
      tree.expandAllNodes();
    } else {
      tree.collapseAllNodes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Tree causes infinite re-renders
  }, [searchQuery]);

  // Combine backend groups with CSV group and filter by search
  const groupedTables = useMemo(() => {
    // Combine all groups
    const allGroups = tableGroups;

    // Filter tables by search query
    const filteredGroups = allGroups.map((group) => ({
      ...group,
      tables: group.tables.filter((table) => table.displayName.toLowerCase().includes(searchQuery.toLowerCase())),
    }));

    // When searching, hide groups with no matching tables
    // When not searching, show all groups (including empty ones for unhealthy connections)
    const visibleGroups = searchQuery ? filteredGroups.filter((group) => group.tables.length > 0) : filteredGroups;

    // Sort groups: CSV uploads last
    return visibleGroups.sort((a, b) => {
      if (a.service === Service.CSV) return 1;
      if (b.service === Service.CSV) return -1;
      return 0;
    });
  }, [tableGroups, searchQuery]);

  const recentlyClosedTables = useMemo(() => {
    return (workbook?.snapshotTables || [])
      .filter((table) => table.hidden)
      .sort((a, b) => a.tableSpec.name.localeCompare(b.tableSpec.name));
  }, [workbook?.snapshotTables]);

  const handleTableSelect = async (table: TableGroup['tables'][0], group: TableGroup) => {
    if (!workbook) return;

    // // Toggle selection
    // if (selectedTableId === table.id) {
    //   setSelectedTableId(null);
    //   return;
    // }

    // setSelectedTableId(table.id);

    // Automatically add the table when selected
    try {
      setIsCreatingTable(true);
      const snapshotTableId = await addTable(table.id, group.service, group.connectorAccountId ?? undefined);

      if (workbookMode === 'files') {
        openFileTab({ id: snapshotTableId, type: 'folder', title: table.displayName });
        closeFileTab('add-table');
      } else {
        setActiveTab(snapshotTableId);
        closeNewTabs();
      }
    } catch (error) {
      console.error('Failed to add table:', error);
      ScratchpadNotifications.error({
        title: 'Failed to add table',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsCreatingTable(false);
      // setSelectedTableId(null);
    }
  };

  const handleRefresh = async (groupKey: string) => {
    // Set loading state for this group
    setRefreshingGroups((prev) => ({ ...prev, [groupKey]: true }));

    try {
      // If refreshing uploaded files, only refresh uploads
      if (groupKey === Service.CSV) {
        // await mutateUploads();
      } else {
        // TODO: Refresh only the tables for the specific service.
        // For other connectors, refresh all tables
        await mutateAllTables();
      }
    } finally {
      // Clear loading state for this group
      setRefreshingGroups((prev) => ({ ...prev, [groupKey]: false }));
    }
  };

  // const handleUploadFile = () => {
  //   modalStack.open('upload');
  // };

  const handleAddSampleTable = async () => {
    if (!workbook) return;

    try {
      setIsCreatingTable(true);
      const snapshotTableId = await addSampleTable();
      markStepCompleted('gettingStartedV1', 'dataSourceConnected');

      if (workbookMode === 'files') {
        openFileTab({ id: snapshotTableId, type: 'folder', title: 'Sample Table' });
        closeFileTab('add-table');
      } else {
        setActiveTab(snapshotTableId);
        closeNewTabs();
      }
    } catch (error) {
      console.error('Failed to add sample table:', error);
      ScratchpadNotifications.error({
        title: 'Failed to add sample table',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsCreatingTable(false);
    }
  };

  const treeData: TreeNodeData[] = useMemo(() => {
    const result: TreeNodeData[] = [];

    if (recentlyClosedTables.length > 0) {
      result.push({
        value: 'recently-closed',
        label: 'Recently closed',
        nodeProps: { type: 'recently-closed-header' },
        children: recentlyClosedTables.map((table) => ({
          value: table.id,
          label: table.tableSpec.name,
          nodeProps: { type: 'recently-closed-item', table },
        })),
      });
    }

    for (const group of groupedTables) {
      const groupKey = createGroupKey(group);
      const children =
        group.tables.length > 0
          ? group.tables.map((table) => {
              const matchingSnapshot = findMatchingSnapshotTable(table.id, workbook?.snapshotTables);
              return {
                value: table.id.wsId,
                label: table.displayName,
                nodeProps: { type: 'group-item', table, group, matchingSnapshot },
              };
            })
          : [
              {
                value: `${groupKey}-empty`,
                label: 'No tables for this connection',
                nodeProps: { type: 'group-empty', group },
              },
            ];
      result.push({
        value: groupKey,
        label: group.displayName,
        nodeProps: { type: 'group-header', group, groupKey },
        children,
      });
    }
    return result;
  }, [recentlyClosedTables, groupedTables, workbook?.snapshotTables]);

  const renderNode = ({
    node,
    expanded,
    elementProps: { className: treeClassName, onClick: treeOnClick, ...restElementProps },
  }: RenderTreeNodePayload) => {
    const { type, table, group, groupKey, matchingSnapshot } = node.nodeProps || {};

    if (type === 'recently-closed-header') {
      return (
        <Group className={cx([styles.listSectionHeader, treeClassName])} onClick={treeOnClick} {...restElementProps}>
          <StyledLucideIcon Icon={expanded ? ChevronDown : ChevronRight} size="sm" />
          <Text13Book>Recently closed</Text13Book>
        </Group>
      );
    }

    if (type === 'recently-closed-item' && table) {
      return (
        <Group
          className={cx([styles.listSectionItem, treeClassName])}
          onClick={() => {
            unhideTable(table.id);
            setActiveTab(table.id);
            closeNewTabs();
          }}
        >
          <ConnectorIcon connector={table.connectorService} size={20} withBorder />
          <Text13Regular style={{ flex: 1 }}>{table.tableSpec.name}</Text13Regular>
          {table.lastSyncTime && (
            <Group gap="xs">
              <StyledLucideIcon Icon={CloudDownload} size="sm" />
              <Text13Regular>{timeAgo(table.lastSyncTime)}</Text13Regular>
            </Group>
          )}
          <IconButtonInline
            onClick={(e) => {
              e.stopPropagation();
              deleteTableModal.open(table.id, table.tableSpec.name);
            }}
          >
            <StyledLucideIcon Icon={Trash2Icon} size="sm" />
          </IconButtonInline>
        </Group>
      );
    }

    if (type === 'group-header' && group) {
      const isRefreshing = refreshingGroups[groupKey];
      return (
        <Group className={cx([styles.listSectionHeader, treeClassName])} onClick={treeOnClick} {...restElementProps}>
          <StyledLucideIcon Icon={expanded ? ChevronDown : ChevronRight} size="sm" />
          <Text13Regular style={{ flex: 1 }}>{group.displayName}</Text13Regular>
          <IconButtonInline
            size="compact-xs"
            disabled={isRefreshing}
            onClick={(e) => {
              e.stopPropagation();
              if (!isRefreshing && groupKey) {
                handleRefresh(groupKey);
              }
            }}
          >
            {isRefreshing ? <Loader size={13} /> : <RefreshCwIcon size={13} />}
          </IconButtonInline>
        </Group>
      );
    }

    if (type === 'group-item' && table && group) {
      return (
        <Group
          className={cx([styles.listSectionItem, treeClassName])}
          onClick={() => handleTableSelect(table, group)}
          {...restElementProps}
        >
          <ConnectorIcon connector={group.service} size={20} withBorder />
          <Text13Regular style={{ flex: 1 }}>{table.displayName}</Text13Regular>
          {matchingSnapshot?.lastSyncTime && (
            <Group gap="xs">
              <StyledLucideIcon Icon={CloudDownload} size="sm" />
              <Text13Regular>{timeAgo(matchingSnapshot.lastSyncTime)}</Text13Regular>
            </Group>
          )}
        </Group>
      );
    }

    if (type === 'group-empty' && group) {
      return (
        <Group className={cx([styles.listSectionItem, treeClassName])} {...restElementProps}>
          <Text13Regular c="dimmed" fs="italic">
            No tables for {group.displayName} connection
          </Text13Regular>
        </Group>
      );
    }

    return null;
  };

  if (!workbook) {
    return <Loader />;
  }

  const isLoading = loadingTables;

  const handleUploadModalClose = () => {
    // When modal closes, close it via modalStack and refresh uploads
    modalStack.close('upload');
    // Refresh the uploads list to show the newly uploaded CSV
    // mutateUploads();
  };

  const handleUploadSuccess = async (uploadId: string) => {
    if (!workbook) return;

    try {
      setIsCreatingTable(true);
      // Create the EntityId for the CSV upload
      const tableId: EntityId = {
        wsId: uploadId,
        remoteId: [uploadId],
      };
      const snapshotTableId = await addTable(tableId, Service.CSV);

      if (workbookMode === 'files') {
        openFileTab({ id: snapshotTableId, type: 'folder', title: 'CSV Upload' });
        closeFileTab('add-table');
      } else {
        setActiveTab(snapshotTableId);
        closeNewTabs();
      }
    } catch (error) {
      console.error('Failed to add uploaded table:', error);
      ScratchpadNotifications.error({
        title: 'Failed to add table',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsCreatingTable(false);
    }
  };

  const contentWithoutExistingSources = (
    <Stack justify="center" gap="lg" my="md" align="center">
      <DecorativeBoxedIcon Icon={PlusIcon} />
      <Stack gap="xs" align="center" w={250}>
        <Text13Medium ta="center">Add new data source</Text13Medium>
        <Text13Book c="dimmed" ta="center">
          Connect a new data source to edit its content in Scratch.
        </Text13Book>
      </Stack>

      <Stack w={400}>
        <ButtonWithDescription
          title="Connect app"
          description="Import data from an app"
          icon={<StyledLucideIcon Icon={PlusIcon} size="md" c={'dimmed'} />}
          onClick={() => modalStack.open('create')}
        />
        <Group w="100%">
          <Divider style={{ flex: 1 }} />
          <TextMono12Regular c="primary">OR</TextMono12Regular>
          <Divider style={{ flex: 1 }} />
        </Group>
        <ButtonWithDescription
          title="Use demo data"
          description="Try out Scratch with demo data."
          icon={<StyledLucideIcon Icon={ArrowRightIcon} size="md" c={'dimmed'} />}
          onClick={handleAddSampleTable}
        />
      </Stack>
    </Stack>
  );
  const contentWithExistingSources = (
    <Stack gap="md" maw={600} mx="auto" h="90%" py="xl">
      <Stack gap="xs" align="center">
        <DecorativeBoxedIcon Icon={PlusIcon} />
        <Text13Medium ta="center">Import table into workbook</Text13Medium>
        <Text13Book c="dimmed" ta="center">
          Select a table to open in the workbook.
        </Text13Book>
      </Stack>

      {/* Bordered container with search and table list */}
      <div
        style={{
          border: '0.5px solid var(--fg-divider)',
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0%',
          overflow: 'hidden',
        }}
      >
        {/* Search bar inside container */}
        <TextInput
          placeholder="Search tables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<StyledLucideIcon Icon={SearchIcon} size="sm" />}
          variant="unstyled"
          styles={{
            input: {
              borderBottom: '0.5px solid var(--fg-divider)',
              borderRadius: 0,
              paddingLeft: 'var(--mantine-spacing-xl)',
            },
          }}
        />

        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : (
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {isCreatingTable && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LoaderWithMessage centered message="Creating table..." />
              </div>
            )}
            {treeData.length > 0 ? (
              <ScrollArea style={{ flex: 1 }}>
                <Tree data={treeData} tree={tree} renderNode={renderNode} classNames={{ node: styles.treeNode }} />
              </ScrollArea>
            ) : searchQuery ? (
              <Text13Regular c="dimmed" ta="center" py="xl" px="sm">
                No tables found matching &quot;{searchQuery}&quot;
              </Text13Regular>
            ) : (
              <Text13Regular c="dimmed" ta="center" py="xl" px="sm">
                No tables available from your connections.
              </Text13Regular>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <Group justify="center" gap="sm" my="md">
        <ButtonSecondaryOutline
          leftSection={<StyledLucideIcon Icon={PlusIcon} size="sm" />}
          onClick={() => modalStack.open('create')}
        >
          New data source
        </ButtonSecondaryOutline>
      </Group>
    </Stack>
  );

  return (
    <>
      <CreateConnectionModal
        {...modalStack.register('create')}
        returnUrl={RouteUrls.workbookNewTabPageUrl(workbook.id)}
      />
      <UploadFileModal
        opened={modalStack.state['upload']}
        onClose={handleUploadModalClose}
        onUploadSuccess={handleUploadSuccess}
      />
      <GenericDeleteConfirmationModal
        title="Delete table"
        onConfirm={async (id: SnapshotTableId) => await deleteTable(id)}
        {...deleteTableModal}
      />
      {groupedTables.length === 0 ? contentWithoutExistingSources : contentWithExistingSources}
    </>
  );
};
