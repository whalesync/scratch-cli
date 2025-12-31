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
import { WorkbookEditorModals } from '@/app/workbooks/[...slug]/components/snapshot-grid/modals/WorkbookEditorModals';
import { WorkbookHeader } from '@/app/workbooks/[...slug]/components/WorkbookHeader';
import { useWorkbookParams } from '@/app/workbooks/[...slug]/hooks/use-workbook-params';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbook } from '@/hooks/use-workbook';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useWorkbookWebSocketStore } from '@/stores/workbook-websocket-store';
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import { Split } from '@gfazioli/mantine-split-pane';
import { Box, Group, Stack, Text } from '@mantine/core';
import { ArrowLeftIcon, FileTextIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { WorkbookFileBrowser } from './components/WorkbookFileBrowser';
import { FileEditor } from './components/FileEditor';

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

  // State for open tabs (array of file paths)
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

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

  return (
    <PageLayout pageTitle={workbook.name ?? 'Workbook'} navVariant="drawer">
      <MainContent bg="var(--bg-panel)">
        <WorkbookHeader />

        <Stack gap={0} w="100%" h="calc(100vh - 36px)" p="0 6 6 6">
          <Box flex={1} style={{ overflow: 'hidden' }}>
            <Split h="100%">
              {/* Left Pane: Tree View */}
              <Split.Pane initialWidth={DEFAULT_LIST_WIDTH} minWidth={MIN_LIST_WIDTH} maxWidth={MAX_LIST_WIDTH}>
                <WorkbookFileBrowser
                  openTabs={openTabs}
                  setOpenTabs={setOpenTabs}
                  activeTabId={activeTabId}
                  setActiveTabId={setActiveTabId}
                  refreshWorkbook={refreshWorkbook}
                />
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Middle Pane: MD Editor */}
              <Split.Pane grow>
                <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
                  {/* Tab Bar */}
                  {openTabs.length > 0 && (
                    <Group gap={0} h={32} style={{ borderBottom: '0.5px solid var(--fg-divider)', overflow: 'auto' }}>
                      {openTabs.map((tabFilePath) => {
                        const fileName = tabFilePath.split('/').pop() || tabFilePath;
                        const isActiveTab = activeTabId === tabFilePath;

                        return (
                          <Group
                            key={tabFilePath}
                            gap={4}
                            px="sm"
                            h={32}
                            onClick={() => {
                              setActiveTabId(tabFilePath);
                              setActiveCells({
                                recordId: tabFilePath,
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
                              {fileName}
                            </Text>
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                // Close tab
                                setOpenTabs((prev) => prev.filter((id) => id !== tabFilePath));
                                // If closing active tab, switch to another tab or null
                                if (activeTabId === tabFilePath) {
                                  const currentIndex = openTabs.indexOf(tabFilePath);
                                  const newTabs = openTabs.filter((id) => id !== tabFilePath);
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
                  <Box flex={1} style={{ overflow: 'hidden' }}>
                    <FileEditor workbookId={workbook.id} filePath={activeTabId} />
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
