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
import { ArrowLeftIcon, FileTextIcon, FolderIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FileEditor } from './components/FileEditor';
import { FolderDetailViewer } from './components/FolderDetailViewer';
import { WorkbookFileBrowser } from './components/WorkbookFileBrowser';

const DEFAULT_CHAT_WIDTH = '360px';
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 800;

const DEFAULT_LIST_WIDTH = '300px';
const MIN_LIST_WIDTH = 200;
const MAX_LIST_WIDTH = 600;

function WorkbookFilesPageContent() {
  const { isDevToolsEnabled } = useDevTools();
  const { tableId: pathTableId } = useWorkbookParams();
  // const activeTab = useWorkbookEditorUIStore((state) => state.activeTab); // Unused
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const devToolsOpen = useWorkbookEditorUIStore((state) => state.devToolsOpen);
  const closeDevTools = useWorkbookEditorUIStore((state) => state.closeDevTools);
  const activeCells = useWorkbookEditorUIStore((state) => state.activeCells);
  const setActiveCells = useWorkbookEditorUIStore((state) => state.setActiveCells);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  // File tab state is now managed in the store
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);
  const closeFileTab = useWorkbookEditorUIStore((state) => state.closeFileTab);
  const setActiveFileTab = useWorkbookEditorUIStore((state) => state.setActiveFileTab);

  const router = useRouter();
  const { workbook, activeTable, isLoading, refreshWorkbook } = useActiveWorkbook();

  const [showManageTablesModal, setShowManageTablesModal] = useState(false);

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
                <WorkbookFileBrowser refreshWorkbook={refreshWorkbook} />
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Middle Pane: MD Editor */}
              <Split.Pane grow>
                <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
                  {/* Tab Bar */}
                  {openFileTabs.length > 0 && (
                    <Group gap={0} h={32} style={{ borderBottom: '0.5px solid var(--fg-divider)', overflow: 'auto' }}>
                      {openFileTabs.map((tabFilePath) => {
                        const fileName = tabFilePath.split('/').pop() || tabFilePath;
                        const isFolder = !fileName.endsWith('.md');
                        const isActiveTab = activeFileTabId === tabFilePath;

                        return (
                          <Group
                            key={tabFilePath}
                            gap={4}
                            px="sm"
                            h={32}
                            onClick={() => {
                              setActiveFileTab(tabFilePath);
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
                            {}
                            {isFolder ? (
                              <FolderIcon size={12} color="var(--fg-secondary)" />
                            ) : (
                              <FileTextIcon size={12} color="var(--fg-secondary)" />
                            )}
                            <Text size="xs" truncate style={{ maxWidth: '120px' }}>
                              {fileName}
                            </Text>
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                // Close tab and handle active tab switching
                                closeFileTab(tabFilePath);
                                // Update activeCells based on new active tab
                                const newActiveId = useWorkbookEditorUIStore.getState().activeFileTabId;
                                setActiveCells({
                                  recordId: newActiveId ?? undefined,
                                  columnId: activeCells?.columnId,
                                  viewType: 'md',
                                });
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
                    {activeFileTabId === null || (activeFileTabId && activeFileTabId.endsWith('.md')) ? (
                      <FileEditor workbookId={workbook.id} filePath={activeFileTabId} />
                    ) : (
                      <FolderDetailViewer workbookId={workbook.id} folderPath={activeFileTabId} />
                    )}
                  </Box>
                </Stack>
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Optional Right Pane: Agent Chat */}
              {chatOpen && (
                <Split.Pane initialWidth={DEFAULT_CHAT_WIDTH} minWidth={MIN_CHAT_WIDTH} maxWidth={MAX_CHAT_WIDTH}>
                  <AIChatPanel />
                </Split.Pane>
              )}
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
          <WorkbookFilesPageContent />
          <PublishWorkbookWorkflow />
          <WorkbookEditorModals />
        </UpdateRecordsProvider>
      </AIAgentSessionManagerProvider>
    </AgentChatContextProvider>
  );
}
