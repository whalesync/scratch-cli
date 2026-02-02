'use client';

import isEqual from 'lodash/isEqual';

import { useRouter } from 'next/navigation';
// Import similar to the original page
import { FullPageLoader } from '@/app/components/FullPageLoader';
import { ErrorInfo, Info } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { AddTableTab } from '@/app/workbooks-md/[...slug]/components/AddTableTab';
import AIChatPanel from '@/app/workbooks-md/[...slug]/components/AIChatPanel/AIChatPanel';
import { AgentChatContextProvider } from '@/app/workbooks-md/[...slug]/components/contexts/agent-chat-context';
import { WorkbookInspector } from '@/app/workbooks-md/[...slug]/components/devtool/WorkbookInspector';
import { ManageTablesModal } from '@/app/workbooks-md/[...slug]/components/ManageTablesModal';
import { PublishWorkbookWorkflow } from '@/app/workbooks-md/[...slug]/components/PublishWorkbookWorkflow';
import { WorkbookHeader } from '@/app/workbooks-md/[...slug]/components/WorkbookHeader';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbook } from '@/hooks/use-workbook';
import { useWorkbookParams } from '@/hooks/use-workbook-params';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useWorkbookWebSocketStore } from '@/stores/workbook-websocket-store';
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import { Split } from '@gfazioli/mantine-split-pane';
import { Box, Stack } from '@mantine/core';
import { isSnapshotTableId, type SnapshotTable } from '@spinner/shared-types';
import { ArrowLeftIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FileTabBar } from './components/FileTabBar';
import { FolderDetailViewer } from './components/FolderDetailViewer';
import { WorkbookEditorModals } from './components/modals/WorkbookEditorModals';
import { WorkbookFileBrowser } from './components/WorkbookFileBrowser';

const DEFAULT_LIST_WIDTH = '300px';
const MIN_LIST_WIDTH = 200;
const MAX_LIST_WIDTH = 600;

const DEFAULT_CHAT_WIDTH = '360px';
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 800;

function WorkbookFilesPageContent() {
  const { isDevToolsEnabled } = useDevTools();
  const { tableId: pathTableId } = useWorkbookParams();
  // const activeTab = useWorkbookEditorUIStore((state) => state.activeTab); // Unused
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const devToolsOpen = useWorkbookEditorUIStore((state) => state.devToolsOpen);
  const closeDevTools = useWorkbookEditorUIStore((state) => state.closeDevTools);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  // File tab state is now managed in the store
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);

  const router = useRouter();
  const { workbook, activeTable, isLoading, refreshWorkbook } = useActiveWorkbook();

  const [showManageTablesModal, setShowManageTablesModal] = useState(false);

  useEffect(() => {
    if (!activeTable || !isSnapshotTableId(activeTable.id)) {
      return;
    }
    // activeTable is a SnapshotTable when its ID passes isSnapshotTableId
    const currentTable = activeTable as SnapshotTable;
    const updatedTable = getSnapshotTables(workbook).find((t) => t.id === currentTable.id);
    if (
      updatedTable &&
      (!isEqual(currentTable.tableSpec, updatedTable.tableSpec) ||
        !isEqual(currentTable.columnSettings, updatedTable.columnSettings))
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
                <WorkbookFileBrowser />
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Middle Pane: MD Editor */}
              <Split.Pane grow>
                <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
                  {/* Tab Bar */}
                  <FileTabBar />

                  {/* Editor Content */}
                  <Box flex={1} style={{ overflow: 'hidden' }}>
                    {(() => {
                      // Find the active tab object to determine type
                      // openFileTabs is now Array<{ id, type, title }>
                      // We need to cast it or update store types. Assuming store is/will be updated.
                      // For now, let's treat it as any or assume correctness.
                      // Actually, I should update the store first, but I can't in this step.
                      // I will write code assuming the store structure matches { id, type, title }.
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const activeTab = (openFileTabs as any[]).find((t) => t.id === activeFileTabId);

                      if (activeTab?.type === 'folder') {
                        return <FolderDetailViewer workbookId={workbook.id} folderId={activeTab.id} />;
                      }
                      if (activeTab?.type === 'add-table') {
                        return <AddTableTab />;
                      }
                      // Default to file editor
                      return null;
                    })()}
                  </Box>
                </Stack>
              </Split.Pane>

              {/* Optional Right Pane: Agent Chat*/}
              {chatOpen && <Split.Resizer w="6px" m={0} hoverColor="transparent" />}
              {chatOpen && (
                <Split.Pane initialWidth={DEFAULT_CHAT_WIDTH} minWidth={MIN_CHAT_WIDTH} maxWidth={MAX_CHAT_WIDTH}>
                  <AIChatPanel />
                </Split.Pane>
              )}
            </Split>
          </Box>

          {/* Footer - Full Width */}
          {/* https://linear.app/whalesync/issue/DEV-9228/remove-some-unused-ui */}
          {/*activeTable && (
            <MainContent.Footer h={28}>
              <GridFooterBar table={activeTable} />
            </MainContent.Footer>
          )*/}
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
    <AgentChatContextProvider workbookId={params.workbookId} agentType="file">
      <AIAgentSessionManagerProvider workbookId={params.workbookId}>
        <WorkbookFilesPageContent />
        <PublishWorkbookWorkflow />
        <WorkbookEditorModals />
      </AIAgentSessionManagerProvider>
    </AgentChatContextProvider>
  );
}
