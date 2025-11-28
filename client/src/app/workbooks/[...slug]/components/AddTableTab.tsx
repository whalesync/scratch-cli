'use client';

import { ButtonSecondaryOutline, IconButtonInline } from '@/app/components/base/buttons';
import { Text13Book, Text13Medium, Text13Regular } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import {
  GenericDeleteConfirmationModal,
  useDeleteConfirmationModal,
} from '@/app/components/modals/GenericDeleteConfirmationModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useAllTables } from '@/hooks/use-all-tables';
import { useUploads } from '@/hooks/use-uploads';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { Service } from '@/types/server-entities/connector-accounts';
import { EntityId, TableGroup } from '@/types/server-entities/table-list';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { RouteUrls } from '@/utils/route-urls';
import {
  Box,
  Center,
  Collapse,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Stack,
  TextInput,
  useModalsStack,
} from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import {
  ChevronDown,
  ChevronRight,
  CloudDownload,
  PlusIcon,
  RefreshCw,
  SearchIcon,
  Trash2Icon,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { DecorativeBoxedIcon } from '../../../components/Icons/DecorativeBoxedIcon';
import { UploadFileModal } from '../../../components/modals/UploadFileModal';
import { CreateConnectionModal } from '../../../data-sources/components/CreateConnectionModal';

// Helper to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

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
  const { workbook, addTable, unhideTable, deleteTable } = useActiveWorkbook();
  const { uploads, isLoading: loadingUploads, mutate: mutateUploads } = useUploads();
  const { tables: tableGroups, isLoading: loadingTables, mutate: mutateAllTables } = useAllTables();
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const closeNewTabs = useWorkbookEditorUIStore((state) => state.closeNewTabs);
  const deleteTableModal = useDeleteConfirmationModal<SnapshotTableId>();
  const modalStack = useModalsStack(['create', 'upload']);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedTableId, setSelectedTableId] = useState<EntityId | null>(null);
  const [refreshingGroups, setRefreshingGroups] = useState<Record<string, boolean>>({});

  // Transform CSV uploads into a TableGroup
  const csvGroup = useMemo((): TableGroup | null => {
    const csvUploads = uploads.filter((upload) => upload.type === 'CSV');
    if (csvUploads.length === 0) return null;

    return {
      service: Service.CSV,
      connectorAccountId: null,
      displayName: 'Uploaded files',
      tables: csvUploads.map((upload) => ({
        id: {
          wsId: upload.id,
          remoteId: [upload.id],
        },
        displayName: upload.name,
      })),
    };
  }, [uploads]);

  // Combine backend groups with CSV group and filter by search
  const groupedTables = useMemo(() => {
    // Combine all groups
    const allGroups = csvGroup ? [...tableGroups, csvGroup] : tableGroups;

    // Filter groups by search query
    const filteredGroups = allGroups
      .map((group) => ({
        ...group,
        tables: group.tables.filter((table) => table.displayName.toLowerCase().includes(searchQuery.toLowerCase())),
      }))
      .filter((group) => group.tables.length > 0);

    // Sort groups: CSV uploads last
    return filteredGroups.sort((a, b) => {
      if (a.service === Service.CSV) return 1;
      if (b.service === Service.CSV) return -1;
      return 0;
    });
  }, [tableGroups, csvGroup, searchQuery]);

  const recentlyClosedTables = useMemo(() => {
    return (workbook?.snapshotTables || [])
      .filter((table) => table.hidden)
      .sort((a, b) => a.tableSpec.name.localeCompare(b.tableSpec.name));
  }, [workbook?.snapshotTables]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const handleTableSelect = async (table: TableGroup['tables'][0], group: TableGroup) => {
    if (!workbook) return;

    // Toggle selection
    if (selectedTableId === table.id) {
      setSelectedTableId(null);
      return;
    }

    setSelectedTableId(table.id);

    // Automatically add the table when selected
    try {
      const snapshotTableId = await addTable(table.id, group.service, group.connectorAccountId ?? undefined);
      setActiveTab(snapshotTableId);
      closeNewTabs();
    } catch (error) {
      console.error('Failed to add table:', error);
      ScratchpadNotifications.error({
        title: 'Failed to add table',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setSelectedTableId(null);
    }
  };

  const handleRefresh = async (groupKey: string) => {
    // Set loading state for this group
    setRefreshingGroups((prev) => ({ ...prev, [groupKey]: true }));

    try {
      // If refreshing uploaded files, only refresh uploads
      if (groupKey === Service.CSV) {
        await mutateUploads();
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

  const handleUploadFile = () => {
    modalStack.open('upload');
  };

  if (!workbook) {
    return <Loader />;
  }

  const isLoading = loadingTables || loadingUploads;

  const handleUploadModalClose = () => {
    // When modal closes, close it via modalStack and refresh uploads
    modalStack.close('upload');
    // Refresh the uploads list to show the newly uploaded CSV
    mutateUploads();
  };

  return (
    <>
      <CreateConnectionModal
        {...modalStack.register('create')}
        returnUrl={RouteUrls.workbookNewTabPageUrl(workbook.id)}
      />
      <UploadFileModal opened={modalStack.state['upload']} onClose={handleUploadModalClose} />
      <GenericDeleteConfirmationModal
        title="Delete table"
        onConfirm={async (id: SnapshotTableId) => await deleteTable(id)}
        {...deleteTableModal}
      />
      <Stack gap="md" maw={600} mx="auto" py="xl">
        <Stack gap="xs" align="center">
          <DecorativeBoxedIcon Icon={PlusIcon} />
          <Text13Medium ta="center">Import table into workbook</Text13Medium>
          <Text13Book c="dimmed" ta="center">
            Select which table you want to import
            <br />
            into the workbook.
          </Text13Book>
        </Stack>

        {/* Bordered container with search and table list */}
        <Box
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-sm)',
            overflow: 'hidden',
            minHeight: 422,
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
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                borderRadius: 0,
                paddingLeft: 'var(--mantine-spacing-xl)',
              },
            }}
          />

          {isLoading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : groupedTables.length > 0 || recentlyClosedTables.length > 0 ? (
            <Stack gap={0}>
              {/* Available in workbook section */}
              {recentlyClosedTables.length > 0 && (
                <>
                  <Text13Book c="dimmed" px="sm" py="xs">
                    Recently closed
                  </Text13Book>
                  {recentlyClosedTables.map((table) => {
                    return (
                      <Box
                        key={table.id}
                        px="sm"
                        py="xs"
                        style={{
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-selected)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '';
                        }}
                        onClick={() => {
                          unhideTable(table.id);
                          setActiveTab(table.id);
                          closeNewTabs();
                        }}
                      >
                        <Group gap="sm" wrap="nowrap">
                          <ConnectorIcon connector={table.connectorService} size={20} />
                          <Text13Regular style={{ flex: 1 }}>{table.tableSpec.name}</Text13Regular>
                          {table.lastSyncTime && (
                            <Group gap="xs">
                              <StyledLucideIcon Icon={CloudDownload} size="sm" c="var(--fg-muted)" />
                              <Text13Regular c="var(--fg-muted)">
                                {formatRelativeTime(table.lastSyncTime)}
                              </Text13Regular>
                            </Group>
                          )}
                          <IconButtonInline
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTableModal.open(table.id, table.tableSpec.name);
                            }}
                          >
                            <StyledLucideIcon Icon={Trash2Icon} size="sm" c="var(--fg-muted)" />
                          </IconButtonInline>
                        </Group>
                      </Box>
                    );
                  })}
                  <Divider />
                </>
              )}

              {/* Grouped tables by connector */}
              {groupedTables.map((group, groupIndex) => {
                const groupKey = createGroupKey(group);
                const isOpen = !!expandedGroups[groupKey];
                const isLastGroup = groupIndex === groupedTables.length - 1;
                const isRefreshing = refreshingGroups[groupKey];

                return (
                  <div key={groupKey}>
                    {/* Group header */}
                    <Group
                      gap="sm"
                      px="sm"
                      py="xs"
                      style={{
                        cursor: 'pointer',
                      }}
                      wrap="nowrap"
                    >
                      <Group gap="sm" style={{ flex: 1 }} onClick={() => toggleGroup(groupKey)} wrap="nowrap">
                        <StyledLucideIcon Icon={isOpen ? ChevronDown : ChevronRight} size="sm" />
                        <Text13Regular>{group.displayName}</Text13Regular>
                      </Group>
                      <Group
                        gap="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isRefreshing) {
                            handleRefresh(groupKey);
                          }
                        }}
                        style={{ cursor: isRefreshing ? 'default' : 'pointer' }}
                      >
                        {isRefreshing ? (
                          <Loader size="xs" />
                        ) : (
                          <StyledLucideIcon Icon={RefreshCw} size="sm" c="var(--fg-muted)" />
                        )}
                      </Group>
                    </Group>

                    {/* Group tables */}
                    <Collapse in={isOpen}>
                      <ScrollArea.Autosize mah={150}>
                        {group.tables.map((table) => {
                          const matchingSnapshot = findMatchingSnapshotTable(table.id, workbook?.snapshotTables);
                          return (
                            <Box
                              key={table.id.wsId}
                              px="sm"
                              py="xs"
                              style={{
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--bg-selected)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '';
                              }}
                              onClick={() => handleTableSelect(table, group)}
                            >
                              <Group gap="sm" wrap="nowrap">
                                <ConnectorIcon connector={group.service} size={20} />
                                <Text13Regular style={{ flex: 1 }}>{table.displayName}</Text13Regular>
                                {matchingSnapshot?.lastSyncTime && (
                                  <Group gap="xs">
                                    <StyledLucideIcon Icon={CloudDownload} size="sm" c="var(--fg-muted)" />
                                    <Text13Regular c="var(--fg-muted)">
                                      {formatRelativeTime(matchingSnapshot.lastSyncTime)}
                                    </Text13Regular>
                                  </Group>
                                )}
                              </Group>
                            </Box>
                          );
                        })}
                      </ScrollArea.Autosize>
                    </Collapse>

                    {/* Divider between groups */}
                    {!isLastGroup && <Divider />}
                  </div>
                );
              })}
            </Stack>
          ) : searchQuery ? (
            <Text13Regular c="dimmed" ta="center" py="xl" px="sm">
              No tables found matching &quot;{searchQuery}&quot;
            </Text13Regular>
          ) : (
            <Text13Regular c="dimmed" ta="center" py="xl" px="sm">
              No tables available from your connections.
            </Text13Regular>
          )}
        </Box>

        {/* Bottom action buttons */}
        <Group justify="center" gap="sm">
          <ButtonSecondaryOutline
            leftSection={<StyledLucideIcon Icon={PlusIcon} size="sm" />}
            onClick={() => modalStack.open('create')}
          >
            New data source
          </ButtonSecondaryOutline>
          <ButtonSecondaryOutline leftSection={<StyledLucideIcon Icon={Upload} size="sm" />} onClick={handleUploadFile}>
            Upload file
          </ButtonSecondaryOutline>
        </Group>
      </Stack>
    </>
  );
};
