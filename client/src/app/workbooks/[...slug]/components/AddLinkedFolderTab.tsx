'use client';

import { ButtonSecondaryOutline, IconButtonInline } from '@/app/components/base/buttons';
import { Text13Book, Text13Medium, Text13Regular } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAllTables } from '@/hooks/use-all-tables';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { TableGroup } from '@/types/server-entities/table-list';
import { timeAgo } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import {
  Center,
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
import { DataFolder, EntityId } from '@spinner/shared-types';
import cx from 'classnames';
import { ChevronDown, ChevronRight, CloudDownload, PlusIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { DecorativeBoxedIcon } from '../../../components/Icons/DecorativeBoxedIcon';
import { CreateConnectionModal } from '../../../data-sources/components/CreateConnectionModal';
import styles from './AddLinkedFolderTab.module.css';

// Helper to find matching snapshot table by comparing EntityIds
const findMatchingDataFolder = (tableId: EntityId, dataFolders: DataFolder[] | undefined): DataFolder | undefined => {
  if (!dataFolders) return undefined;
  return dataFolders.find((df) => df.tableId.every((r) => tableId.remoteId.includes(r)));
};

function createGroupKey(group: TableGroup) {
  return `${group.service}-${group.connectorAccountId ?? ''}`;
}

export const AddLinkedFolderTab = () => {
  const { workbook, addLinkedDataFolder } = useActiveWorkbook();
  const { tables: tableGroups, isLoading: loadingTables, mutate: mutateAllTables } = useAllTables();
  const modalStack = useModalsStack(['create']);
  const openFileTab = useWorkbookEditorUIStore((state) => state.openFileTab);
  const closeFileTab = useWorkbookEditorUIStore((state) => state.closeFileTab);

  const tree = useTree();

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshingGroups, setRefreshingGroups] = useState<Record<string, boolean>>({});
  const [isCreatingTable, setIsCreatingTable] = useState(false);

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
    return searchQuery ? filteredGroups.filter((group) => group.tables.length > 0) : filteredGroups;
  }, [tableGroups, searchQuery]);

  const handleTableSelect = async (table: TableGroup['tables'][0], group: TableGroup) => {
    if (!workbook) return;
    if (!group.connectorAccountId) return;

    // Automatically add the table when selected
    try {
      setIsCreatingTable(true);
      const dataFolder = await addLinkedDataFolder(table.id.remoteId, table.displayName, group.connectorAccountId);

      openFileTab({
        id: dataFolder.id,
        type: 'folder',
        title: dataFolder.name,
        path: dataFolder.path ?? `/${table.displayName}`,
      });
      closeFileTab('add-table');
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
      // TODO: Refresh only the tables for the specific service.
      await mutateAllTables();
    } finally {
      // Clear loading state for this group
      setRefreshingGroups((prev) => ({ ...prev, [groupKey]: false }));
    }
  };

  const treeData: TreeNodeData[] = useMemo(() => {
    const result: TreeNodeData[] = [];

    for (const group of groupedTables) {
      const groupKey = createGroupKey(group);
      const children =
        group.tables.length > 0
          ? group.tables.map((table) => {
              const matchingFolder = findMatchingDataFolder(table.id, workbook?.dataFolders);
              return {
                value: table.id.wsId,
                label: table.displayName,
                nodeProps: { type: 'group-item', table, group, matchingSnapshot: matchingFolder },
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
  }, [groupedTables, workbook?.dataFolders]);

  const renderNode = ({
    node,
    expanded,
    elementProps: { className: treeClassName, onClick: treeOnClick, ...restElementProps },
  }: RenderTreeNodePayload) => {
    const { type, table, group, groupKey, matchingSnapshot } = node.nodeProps || {};

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
      const isAlreadyLinked = !!matchingSnapshot;
      const { style: elementStyle, ...otherElementProps } = restElementProps;
      return (
        <Group
          className={cx([styles.listSectionItem, treeClassName, isAlreadyLinked && styles.listSectionItemDisabled])}
          onClick={isAlreadyLinked ? undefined : () => handleTableSelect(table, group)}
          style={{
            ...elementStyle,
            ...(isAlreadyLinked ? { cursor: 'default', opacity: 0.6 } : {}),
          }}
          {...otherElementProps}
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
        <ButtonSecondaryOutline
          leftSection={<StyledLucideIcon Icon={PlusIcon} size="sm" />}
          onClick={() => modalStack.open('create')}
        >
          Connect app
        </ButtonSecondaryOutline>
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
      {isLoading ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : groupedTables.length === 0 ? (
        contentWithoutExistingSources
      ) : (
        contentWithExistingSources
      )}
    </>
  );
};
