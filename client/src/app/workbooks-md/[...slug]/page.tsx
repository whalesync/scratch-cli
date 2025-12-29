'use client';

import isEqual from 'lodash/isEqual';

import { useRouter } from 'next/navigation';
// Import similar to the original page
import { FullPageLoader } from '@/app/components/FullPageLoader';
import { ErrorInfo, Info } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import AIChatPanel from '@/app/workbooks/[...slug]/components/AIChatPanel/AIChatPanel';
import { AgentChatContextProvider } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { UpdateRecordsProvider } from '@/app/workbooks/[...slug]/components/contexts/update-records-context';
import { WorkbookInspector } from '@/app/workbooks/[...slug]/components/devtool/WorkbookInspector';
import { ManageTablesModal } from '@/app/workbooks/[...slug]/components/ManageTablesModal';
import { PublishWorkbookWorkflow } from '@/app/workbooks/[...slug]/components/PublishWorkbookWorkflow';
import { GridFooterBar } from '@/app/workbooks/[...slug]/components/snapshot-grid/grid-footer-bar/GridFooterBar';
import { parseMdFileForNewRecord } from '@/app/workbooks/[...slug]/components/snapshot-grid/md-utils';
import { WorkbookEditorModals } from '@/app/workbooks/[...slug]/components/snapshot-grid/modals/WorkbookEditorModals';
import { RecordMdEditor, RecordMdEditorRef } from '@/app/workbooks/[...slug]/components/snapshot-grid/RecordMdEditor';
import { WorkbookHeader } from '@/app/workbooks/[...slug]/components/WorkbookHeader';
import { useWorkbookParams } from '@/app/workbooks/[...slug]/hooks/use-workbook-params';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { useWorkbook } from '@/hooks/use-workbook';
import { recordApi } from '@/lib/api/record';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useWorkbookWebSocketStore } from '@/stores/workbook-websocket-store';
import { buildRecordTitle } from '@/types/server-entities/workbook';
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import { Split } from '@gfazioli/mantine-split-pane';
import { Box, Button, Group, ScrollArea, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import type { SnapshotTable, TableSpec } from '@spinner/shared-types';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  TableIcon,
  UploadIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_CHAT_WIDTH = '360px';
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 800;

const DEFAULT_LIST_WIDTH = '300px';
const MIN_LIST_WIDTH = 200;
const MAX_LIST_WIDTH = 600;

function WorkbookNewPageContent() {
  const { isDevToolsEnabled } = useDevTools();
  const { tableId: pathTableId } = useWorkbookParams();
  // const activeTab = useWorkbookEditorUIStore((state) => state.activeTab); // Unused
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const devToolsOpen = useWorkbookEditorUIStore((state) => state.devToolsOpen);
  const closeDevTools = useWorkbookEditorUIStore((state) => state.closeDevTools);
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);

  // NOTE: In this view, we always show chat. But let's respect the user preference if we wanted to.
  // The requirements say "Exact same agent section", implying likely the same toggle behavior or just always separate.
  // "on the right the EXACT SAME agent section"
  // const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen); // Unused

  const router = useRouter();
  const { workbook, activeTable, isLoading, refreshWorkbook } = useActiveWorkbook();

  const [showManageTablesModal, setShowManageTablesModal] = useState(false);

  // Use snapshot records hook for the active table
  const { records, isLoading: isLoadingRecords } = useSnapshotTableRecords({
    // Fixed isLoadingRecords and undefined records fallback
    workbookId: workbook?.id ?? null,
    tableId: activeTable?.id ?? null,
  });

  const recordsList = records ?? []; // Safe fallback

  // State for the MD editor
  const [editorHasChanges, setEditorHasChanges] = useState(false);
  const editorRef = useRef<RecordMdEditorRef>(null);

  // State for workbook tree expansion
  const [workbookExpanded, setWorkbookExpanded] = useState(true);

  // State for table expansion (track which tables are expanded)
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());

  // State for open tabs (array of record IDs)
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // State for tracking which table is being dragged over
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  // State for tracking record being dragged (for moving between tables)
  const [draggingRecord, setDraggingRecord] = useState<{
    recordId: string;
    sourceTableId: SnapshotTable['id'];
  } | null>(null);

  // Handler for dropping MD files onto a table folder to create new records
  const handleMdFileDrop = useCallback(
    async (files: File[], table: SnapshotTable) => {
      if (!workbook || !table.tableSpec) return;

      const tableSpec = table.tableSpec as TableSpec;

      for (const file of files) {
        try {
          const content = await file.text();
          const fields = parseMdFileForNewRecord(content, tableSpec);

          // Create the record via the API
          await recordApi.bulkUpdateRecords(workbook.id, table.id, {
            creates: [
              {
                op: 'create',
                data: fields,
              },
            ],
            updates: [],
            deletes: [],
            undeletes: [],
          });

          notifications.show({
            title: 'Record created',
            message: `Created record from ${file.name}`,
            color: 'green',
          });
        } catch (error) {
          console.error('Failed to create record from MD file:', error);
          notifications.show({
            title: 'Failed to create record',
            message: error instanceof Error ? error.message : 'Unknown error',
            color: 'red',
          });
        }
      }

      // Refresh workbook to get the new records
      if (refreshWorkbook) {
        await refreshWorkbook();
      }
    },
    [workbook, refreshWorkbook],
  );

  // Handler for moving a record from one table to another
  const handleRecordMove = useCallback(
    async (recordId: string, sourceTableId: SnapshotTable['id'], targetTable: SnapshotTable) => {
      if (!workbook || !targetTable.tableSpec) return;
      if (sourceTableId === targetTable.id) return; // Can't move to same table

      const tables = getSnapshotTables(workbook);
      const sourceTable = tables.find((t) => t.id === sourceTableId);
      if (!sourceTable?.tableSpec) return;

      // Find the record in the source table's records
      // We need to get the record data - it should be in the current recordsList if we're viewing that table
      // But we may be viewing a different table, so we need to fetch it
      try {
        // Get records from source table
        const sourceRecords = await recordApi.listRecords(workbook.id, sourceTableId);
        const record = sourceRecords.records.find((r) => r.id.wsId === recordId);

        if (!record) {
          notifications.show({
            title: 'Move failed',
            message: 'Could not find record to move',
            color: 'red',
          });
          return;
        }

        // Get the fields from the record (use __fields if available)
        const fields = record.__fields || record.fields || {};

        // Create in target table
        await recordApi.bulkUpdateRecords(workbook.id, targetTable.id, {
          creates: [{ op: 'create', data: fields }],
          updates: [],
          deletes: [],
          undeletes: [],
        });

        // Delete from source table
        await recordApi.bulkUpdateRecords(workbook.id, sourceTableId, {
          creates: [],
          updates: [],
          deletes: [{ op: 'delete', wsId: recordId }],
          undeletes: [],
        });

        // Close tab if it was open
        setOpenTabs((prev) => prev.filter((id) => id !== recordId));
        if (activeTabId === recordId) {
          setActiveTabId(null);
        }

        notifications.show({
          title: 'Record moved',
          message: `Moved record to ${targetTable.tableSpec?.name || targetTable.id}`,
          color: 'green',
        });

        // Refresh workbook to get updated records
        if (refreshWorkbook) {
          await refreshWorkbook();
        }
      } catch (error) {
        console.error('Failed to move record:', error);
        notifications.show({
          title: 'Move failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      }
    },
    [workbook, activeTabId, refreshWorkbook],
  );

  useEffect(() => {
    if (!activeTable) {
      return;
    }
    const updatedTable = getSnapshotTables(workbook).find((t) => t.id === activeTable.id);
    if (
      updatedTable &&
      (!isEqual(activeTable.tableSpec, updatedTable.tableSpec) ||
        !isEqual(activeTable.columnSettings, updatedTable.columnSettings))
    ) {
      setActiveTab(updatedTable.id);
    }
  }, [workbook, activeTable, pathTableId, setActiveTab]);

  // Handle saving via keyboard shortcut or button
  const handleSave = async () => {
    if (editorRef.current) {
      await editorRef.current.save();
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading && !workbook) {
    return <FullPageLoader message="Loading workbook..." />;
  }

  if (!workbook) {
    return (
      <PageLayout pageTitle={'Unknown Workbook'}>
        <MainContent>
          <MainContent.BasicHeader title="" />
          <MainContent.Body>
            <ErrorInfo
              title="Workbook not found."
              description="We were unable to find the workbook you are looking for."
              action={
                <Info.ActionButton
                  label="Return to workbooks"
                  Icon={ArrowLeftIcon}
                  onClick={() => router.push(RouteUrls.workbooksPageUrl)}
                />
              }
            />
          </MainContent.Body>
        </MainContent>
      </PageLayout>
    );
  }

  const allTables = getSnapshotTables(workbook, true);

  // Derived state for the middle pane
  const selectedRecordId = activeCells?.recordId;

  return (
    <PageLayout pageTitle={workbook.name ?? 'Workbook'} navVariant="drawer">
      <MainContent bg="var(--bg-panel)">
        <WorkbookHeader />

        <Stack gap={0} w="100%" h="calc(100vh - 36px)" p="0 6 6 6">
          <Box flex={1} style={{ overflow: 'hidden' }}>
            <Split h="100%">
              {/* Left Pane: Tree View */}
              <Split.Pane initialWidth={DEFAULT_LIST_WIDTH} minWidth={MIN_LIST_WIDTH} maxWidth={MAX_LIST_WIDTH}>
                <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
                  {/* Tree Header */}
                  <Group
                    h={36}
                    px="xs"
                    justify="space-between"
                    style={{ borderBottom: '0.5px solid var(--fg-divider)' }}
                  >
                    <Text fw={500} size="sm">
                      Explorer
                    </Text>
                    <Group gap={4}>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<PlusIcon size={12} />}
                        onClick={() => router.push(RouteUrls.workbooksPageUrl)}
                      >
                        WB
                      </Button>
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        color="gray"
                        leftSection={<PlusIcon size={12} />}
                        onClick={() => router.push(RouteUrls.workbookNewTabPageUrl(workbook.id))}
                      >
                        Table
                      </Button>
                    </Group>
                  </Group>

                  <ScrollArea style={{ flex: 1 }}>
                    <Stack gap={0} p="xs">
                      {/* Workbook Node (Top Level) */}
                      <Box>
                        <Group
                          gap="xs"
                          h={24}
                          px="sm"
                          onClick={() => setWorkbookExpanded(!workbookExpanded)}
                          style={{
                            cursor: 'pointer',
                            borderRadius: '4px',
                          }}
                          bg="transparent"
                        >
                          {workbookExpanded ? (
                            <ChevronDownIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
                          ) : (
                            <ChevronRightIcon size={14} color="var(--fg-secondary)" style={{ flexShrink: 0 }} />
                          )}
                          <BookOpenIcon size={14} color="var(--fg-secondary)" />
                          <Text size="sm" fw={500} c="var(--fg-primary)" truncate>
                            {workbook.name || 'Untitled Workbook'}
                          </Text>
                        </Group>

                        {/* Tables (Level 1, nested under Workbook) */}
                        {workbookExpanded && (
                          <Stack gap={0} ml={6} style={{ borderLeft: '1px solid var(--fg-divider)' }}>
                            {allTables.map((table) => {
                              const isActiveTable = activeTable?.id === table.id;
                              const isTableExpanded = expandedTables.has(table.id);

                              const toggleTableExpansion = (e: React.MouseEvent) => {
                                e.stopPropagation();
                                setExpandedTables((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(table.id)) {
                                    next.delete(table.id);
                                  } else {
                                    next.add(table.id);
                                  }
                                  return next;
                                });
                              };

                              const isDragOver = dragOverTableId === table.id;

                              return (
                                <Dropzone
                                  key={table.id}
                                  onDrop={(files) => {
                                    setDragOverTableId(null);
                                    handleMdFileDrop(files, table);
                                  }}
                                  onReject={(rejections) => {
                                    setDragOverTableId(null);
                                    console.log('Files rejected:', rejections);
                                    notifications.show({
                                      title: 'File rejected',
                                      message: 'Only .md and .txt files are accepted',
                                      color: 'red',
                                    });
                                  }}
                                  onDragEnter={() => setDragOverTableId(table.id)}
                                  onDragLeave={() => setDragOverTableId(null)}
                                  accept={{
                                    'text/plain': ['.txt', '.md'],
                                    'text/markdown': ['.md'],
                                  }}
                                  multiple
                                  activateOnClick={false}
                                  enablePointerEvents
                                  styles={{
                                    root: {
                                      border: 'none',
                                      padding: 0,
                                      backgroundColor: 'transparent',
                                    },
                                  }}
                                >
                                  <Box
                                    onDragOver={(e) => {
                                      // Check if this is a record move (not a file drop - Dropzone handles that)
                                      if (e.dataTransfer.types.includes('application/x-record-move')) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Don't show drop indicator on the source table
                                        if (draggingRecord?.sourceTableId === table.id) {
                                          e.dataTransfer.dropEffect = 'none';
                                          return;
                                        }
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverTableId !== table.id) {
                                          setDragOverTableId(table.id);
                                        }
                                      }
                                    }}
                                    onDragLeave={(e) => {
                                      // Only clear if leaving this specific element
                                      if (e.dataTransfer.types.includes('application/x-record-move')) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // Check if we're leaving to a child element
                                        const relatedTarget = e.relatedTarget as Node | null;
                                        if (!e.currentTarget.contains(relatedTarget)) {
                                          setDragOverTableId(null);
                                        }
                                      }
                                    }}
                                    onDrop={(e) => {
                                      // Handle record move drops
                                      const recordMoveData = e.dataTransfer.getData('application/x-record-move');
                                      if (recordMoveData) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDragOverTableId(null);
                                        try {
                                          const { recordId, sourceTableId } = JSON.parse(recordMoveData);
                                          // Don't move to same table
                                          if (sourceTableId !== table.id) {
                                            handleRecordMove(recordId, sourceTableId, table);
                                          }
                                        } catch (err) {
                                          console.error('Failed to parse record move data:', err);
                                        }
                                      }
                                    }}
                                    style={{
                                      borderRadius: '4px',
                                      outline: isDragOver ? '2px dashed var(--mantine-color-blue-5)' : 'none',
                                      outlineOffset: '-2px',
                                    }}
                                  >
                                    {/* Table Node */}
                                    <Group
                                      gap="xs"
                                      h={24}
                                      pl={18}
                                      pr="xs"
                                      onClick={() => {
                                        setActiveTab(table.id);
                                        // Auto-expand when selecting a table
                                        setExpandedTables((prev) => {
                                          const next = new Set(prev);
                                          next.add(table.id);
                                          return next;
                                        });
                                      }}
                                      style={{
                                        cursor: 'pointer',
                                        borderRadius: '4px',
                                      }}
                                      bg={
                                        isDragOver
                                          ? 'var(--mantine-color-blue-1)'
                                          : isActiveTable
                                            ? 'var(--bg-surface-hover)'
                                            : 'transparent'
                                      }
                                    >
                                      <Box
                                        onClick={toggleTableExpansion}
                                        style={{ display: 'flex', cursor: 'pointer' }}
                                      >
                                        {isTableExpanded ? (
                                          <ChevronDownIcon
                                            size={14}
                                            color="var(--fg-secondary)"
                                            style={{ flexShrink: 0 }}
                                          />
                                        ) : (
                                          <ChevronRightIcon
                                            size={14}
                                            color="var(--fg-secondary)"
                                            style={{ flexShrink: 0 }}
                                          />
                                        )}
                                      </Box>
                                      {isDragOver ? (
                                        <UploadIcon size={14} color="var(--mantine-color-blue-6)" />
                                      ) : (
                                        <TableIcon size={14} color="var(--fg-secondary)" />
                                      )}
                                      <Text
                                        size="sm"
                                        fw={500}
                                        c={
                                          isDragOver
                                            ? 'var(--mantine-color-blue-6)'
                                            : isActiveTable
                                              ? 'var(--fg-primary)'
                                              : 'var(--fg-secondary)'
                                        }
                                        truncate
                                      >
                                        {isDragOver
                                          ? draggingRecord
                                            ? 'Drop to move record'
                                            : 'Drop to create record'
                                          : table.tableSpec?.name || table.id}
                                      </Text>
                                    </Group>

                                    {/* Records (Level 2) */}
                                    {isActiveTable && isTableExpanded && (
                                      <Stack gap={0} ml={6} style={{ borderLeft: '1px solid var(--fg-divider)' }}>
                                        {recordsList.map((record) => {
                                          const isSelected = record.id.wsId === selectedRecordId;
                                          const isDragging = draggingRecord?.recordId === record.id.wsId;
                                          const isDeleted = !!record.__edited_fields?.__deleted;
                                          const isCreated = !!record.__edited_fields?.__created;
                                          return (
                                            <Group
                                              key={record.id.wsId}
                                              h={24}
                                              pl={18}
                                              pr="xs"
                                              gap="xs"
                                              draggable
                                              onDragStart={(e) => {
                                                e.stopPropagation();
                                                // Set drag data for record move
                                                e.dataTransfer.setData(
                                                  'application/x-record-move',
                                                  JSON.stringify({
                                                    recordId: record.id.wsId,
                                                    sourceTableId: table.id,
                                                  }),
                                                );
                                                e.dataTransfer.effectAllowed = 'move';
                                                setDraggingRecord({
                                                  recordId: record.id.wsId,
                                                  sourceTableId: table.id,
                                                });
                                              }}
                                              onDragEnd={() => {
                                                setDraggingRecord(null);
                                              }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const recordId = record.id.wsId;

                                                // Add to open tabs if not already open
                                                setOpenTabs((prev) => {
                                                  if (!prev.includes(recordId)) {
                                                    return [...prev, recordId];
                                                  }
                                                  return prev;
                                                });

                                                // Set as active tab
                                                setActiveTabId(recordId);

                                                // Keep the old activeCells logic for compatibility
                                                setActiveCells({
                                                  recordId: recordId,
                                                  columnId: activeCells?.columnId,
                                                  viewType: 'md',
                                                });
                                              }}
                                              bg={isSelected ? 'var(--bg-selected)' : 'transparent'}
                                              style={{
                                                cursor: isDragging ? 'grabbing' : 'grab',
                                                opacity: isDragging ? 0.5 : 1,
                                              }}
                                            >
                                              <FileTextIcon
                                                size={12}
                                                color={
                                                  isDeleted
                                                    ? 'var(--mantine-color-red-6)'
                                                    : isCreated
                                                      ? 'var(--mantine-color-green-6)'
                                                      : 'var(--fg-secondary)'
                                                }
                                                style={{ flexShrink: 0 }}
                                              />
                                              <Text
                                                size="sm"
                                                truncate
                                                c={
                                                  isDeleted
                                                    ? 'var(--mantine-color-red-6)'
                                                    : isCreated
                                                      ? 'var(--mantine-color-green-6)'
                                                      : 'var(--fg-secondary)'
                                                }
                                                td={isDeleted ? 'line-through' : undefined}
                                              >
                                                {buildRecordTitle(record)}.md
                                              </Text>
                                            </Group>
                                          );
                                        })}
                                        {recordsList.length === 0 && !isLoadingRecords && (
                                          <Box pl={18} py="xs">
                                            <Text size="xs" c="dimmed">
                                              No records
                                            </Text>
                                          </Box>
                                        )}
                                        {isLoadingRecords && (
                                          <Box pl={18} py="xs">
                                            <Text size="xs" c="dimmed">
                                              Loading...
                                            </Text>
                                          </Box>
                                        )}
                                      </Stack>
                                    )}
                                  </Box>
                                </Dropzone>
                              );
                            })}
                          </Stack>
                        )}
                      </Box>
                    </Stack>
                  </ScrollArea>
                </Stack>
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Middle Pane: MD Editor */}
              <Split.Pane grow>
                <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
                  {/* Tab Bar */}
                  {openTabs.length > 0 && (
                    <Group gap={0} h={32} style={{ borderBottom: '0.5px solid var(--fg-divider)', overflow: 'auto' }}>
                      {openTabs.map((tabRecordId) => {
                        const tabRecord = recordsList.find((r) => r.id.wsId === tabRecordId);
                        if (!tabRecord) return null;

                        const isActiveTab = activeTabId === tabRecordId;

                        return (
                          <Group
                            key={tabRecordId}
                            gap={4}
                            px="sm"
                            h={32}
                            onClick={() => {
                              setActiveTabId(tabRecordId);
                              setActiveCells({
                                recordId: tabRecordId,
                                columnId: activeCells?.columnId,
                                viewType: 'md',
                              });
                            }}
                            style={{
                              cursor: 'pointer',
                              borderRight: '1px solid var(--fg-divider)',
                              backgroundColor: isActiveTab ? 'var(--bg-base)' : 'var(--bg-surface)',
                              borderBottom: isActiveTab ? '2px solid var(--mantine-color-blue-6)' : 'none',
                            }}
                          >
                            <FileTextIcon size={12} color="var(--fg-secondary)" />
                            <Text size="xs" truncate style={{ maxWidth: '120px' }}>
                              {buildRecordTitle(tabRecord)}.md
                            </Text>
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                // Close tab
                                setOpenTabs((prev) => prev.filter((id) => id !== tabRecordId));
                                // If closing active tab, switch to another tab or null
                                if (activeTabId === tabRecordId) {
                                  const currentIndex = openTabs.indexOf(tabRecordId);
                                  const newTabs = openTabs.filter((id) => id !== tabRecordId);
                                  if (newTabs.length > 0) {
                                    // Switch to previous tab or first tab
                                    const newActiveId = newTabs[Math.max(0, currentIndex - 1)];
                                    setActiveTabId(newActiveId);
                                    setActiveCells({
                                      recordId: newActiveId,
                                      columnId: activeCells?.columnId,
                                      viewType: 'md',
                                    });
                                  } else {
                                    setActiveTabId(null);
                                    setActiveCells({
                                      recordId: undefined,
                                      columnId: activeCells?.columnId,
                                      viewType: 'md',
                                    });
                                  }
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px',
                                borderRadius: '2px',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-3)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <XIcon size={12} color="var(--fg-secondary)" />
                            </Box>
                          </Group>
                        );
                      })}
                    </Group>
                  )}

                  {/* Editor Content */}
                  <Box flex={1} style={{ overflow: 'hidden', position: 'relative' }}>
                    {/* Save button - absolutely positioned */}
                    {activeTabId && editorHasChanges && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          zIndex: 10,
                        }}
                      >
                        <Button size="compact-xs" leftSection={<SaveIcon size={12} />} onClick={handleSave}>
                          Save
                        </Button>
                      </Box>
                    )}
                    {activeTabId && activeTable ? (
                      (() => {
                        const activeRecord = recordsList.find((r) => r.id.wsId === activeTabId);
                        return activeRecord ? (
                          <RecordMdEditor
                            ref={editorRef}
                            workbookId={workbook.id}
                            selectedRecord={activeRecord}
                            table={activeTable}
                            onHasChangesHelper={setEditorHasChanges}
                          />
                        ) : (
                          <Box
                            p="xl"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
                          >
                            <Text c="dimmed">Record not found</Text>
                          </Box>
                        );
                      })()
                    ) : (
                      <Box
                        p="xl"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
                      >
                        <Text c="dimmed">Select a record to view content</Text>
                      </Box>
                    )}
                  </Box>
                </Stack>
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Right Pane: Agent Chat */}
              <Split.Pane initialWidth={DEFAULT_CHAT_WIDTH} minWidth={MIN_CHAT_WIDTH} maxWidth={MAX_CHAT_WIDTH}>
                <AIChatPanel />
              </Split.Pane>
            </Split>
          </Box>

          {/* Footer - Full Width */}
          {activeTable && (
            <MainContent.Footer h={28}>
              <GridFooterBar table={activeTable} />
            </MainContent.Footer>
          )}
        </Stack>
      </MainContent>

      {/* Modals */}
      <ManageTablesModal
        isOpen={showManageTablesModal}
        onClose={() => setShowManageTablesModal(false)}
        onSave={async () => {
          if (refreshWorkbook) {
            await refreshWorkbook();
          }
        }}
        workbookId={workbook.id}
        tables={allTables}
      />
      {isDevToolsEnabled && <WorkbookInspector opened={devToolsOpen} onClose={closeDevTools} />}
    </PageLayout>
  );
}

export default function WorkbookNewPage() {
  // Exactly the same wrapper as the original page
  const params = useWorkbookParams();

  // Top level logic for managing the workbook editor UI state.
  const openWorkbook = useWorkbookEditorUIStore((state) => state.openWorkbook);
  const closeWorkbook = useWorkbookEditorUIStore((state) => state.closeWorkbook);
  const reconcileWithWorkbook = useWorkbookEditorUIStore((state) => state.reconcileWithWorkbook);
  const closeNavDrawer = useLayoutManagerStore((state) => state.closeNavDrawer);

  const connectWorkbookWebSocket = useWorkbookWebSocketStore((state) => state.connect);
  const disconnectWorkbookWebSocket = useWorkbookWebSocketStore((state) => state.disconnect);

  useEffect(() => {
    openWorkbook(params);

    return () => {
      closeWorkbook();
      closeNavDrawer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.workbookId, openWorkbook, closeWorkbook, closeNavDrawer]);

  useEffect(() => {
    connectWorkbookWebSocket(params.workbookId);

    return () => {
      disconnectWorkbookWebSocket();
    };
  }, [params.workbookId, connectWorkbookWebSocket, disconnectWorkbookWebSocket]);

  const { workbook } = useWorkbook(params.workbookId);
  useEffect(() => {
    if (workbook) {
      reconcileWithWorkbook(workbook);
    }
  }, [workbook, reconcileWithWorkbook]);

  return (
    <AgentChatContextProvider workbookId={params.workbookId}>
      <AIAgentSessionManagerProvider workbookId={params.workbookId}>
        <UpdateRecordsProvider>
          <WorkbookNewPageContent />
          <PublishWorkbookWorkflow />
          <WorkbookEditorModals />
        </UpdateRecordsProvider>
      </AIAgentSessionManagerProvider>
    </AgentChatContextProvider>
  );
}
