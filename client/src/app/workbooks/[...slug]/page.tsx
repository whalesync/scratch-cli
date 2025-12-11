'use client';

import isEqual from 'lodash/isEqual';

import { useRouter } from 'next/navigation';
import AIChatPanel from './components/AIChatPanel/AIChatPanel';

import { ErrorInfo, Info } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { AgentChatContextProvider } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbookWebSocketStore } from '@/stores/workbook-websocket-store';
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import { Split } from '@gfazioli/mantine-split-pane';
import { Box, Stack } from '@mantine/core';
import { ArrowLeftIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../hooks/use-active-workbook';
import { useWorkbook } from '../../../hooks/use-workbook';
import { useLayoutManagerStore } from '../../../stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '../../../stores/workbook-editor-store';
import { AddTableTab } from './components/AddTableTab';
import { UpdateRecordsProvider } from './components/contexts/update-records-context';
import { WorkbookInspector } from './components/devtool/WorkbookInspector';
import { ManageTablesModal } from './components/ManageTablesModal';
import { PublishWorkbookWorkflow } from './components/PublishWorkbookWorkflow';
import { GridFooterBar } from './components/snapshot-grid/grid-footer-bar/GridFooterBar';
import { WorkbookEditorModals } from './components/snapshot-grid/modals/WorkbookEditorModals';
import SnapshotGrid from './components/snapshot-grid/SnapshotGrid';
import { WorkbookHeader } from './components/WorkbookHeader';
import { WorkbookTabBar } from './components/WorkbookTabBar';
import { useWorkbookParams } from './hooks/use-workbook-params';

const DEFAULT_CHAT_WIDTH = '360px';
const MIN_CHAT_WIDTH = 300;
const MAX_CHAT_WIDTH = 800;

function WorkbookPageContent() {
  const { isDevToolsEnabled } = useDevTools();
  const { tableId: pathTableId } = useWorkbookParams();
  const activeTab = useWorkbookEditorUIStore((state) => state.activeTab);
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const devToolsOpen = useWorkbookEditorUIStore((state) => state.devToolsOpen);
  const closeDevTools = useWorkbookEditorUIStore((state) => state.closeDevTools);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  const router = useRouter();
  const { workbook, activeTable, isLoading, refreshWorkbook } = useActiveWorkbook();

  const [showManageTablesModal, setShowManageTablesModal] = useState(false);

  useEffect(() => {
    if (!activeTable) {
      return;
    }
    // check to see if the content of the active table has changed and reset the object if it has, to trigger re-render of the grid
    const updatedTable = getSnapshotTables(workbook).find((t) => t.id === activeTable.id);
    if (
      updatedTable &&
      (!isEqual(activeTable.tableSpec, updatedTable.tableSpec) ||
        !isEqual(activeTable.columnSettings, updatedTable.columnSettings))
    ) {
      // update the active table and table context with the newer version
      setActiveTab(updatedTable.id);
    }
  }, [workbook, activeTable, pathTableId, setActiveTab]);

  // Temp place untill we have a better handling of hotkeys, commands,
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'p') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track whether chat should be visible
  const chatVisible = useMemo(() => {
    return activeTable && chatOpen;
  }, [activeTable, chatOpen]);

  // Only show loader on initial load, not during revalidation
  if (isLoading && !workbook) {
    return <LoaderWithMessage centered message="Loading workbook..." />;
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

  const allTables = getSnapshotTables(workbook, true); // Include hidden tables

  let content = null;
  let contentFooter = null;
  if (workbook) {
    if (activeTable) {
      content = <SnapshotGrid workbook={workbook} table={activeTable} />;
      contentFooter = <GridFooterBar table={activeTable} />;
    } else if (activeTab?.startsWith('new-tab')) {
      content = <AddTableTab />;
    }
  }
  /*
   * NOTE:
   *   The height of the content is calculated as 100vh - 36px to account for the header
   *   Without using this calculation (i.e. using h="100%"), scrollable divs inside the content
   *   will push the bounds of the content area out of the viewport
   */

  return (
    <PageLayout pageTitle={workbook.name ?? 'Workbook'} navVariant="drawer">
      <MainContent bg="var(--bg-panel)">
        <WorkbookHeader />
        {chatVisible ? (
          <Box p="0 6 6 6" w="100%" h="calc(100vh - 36px)" style={{ overflow: 'hidden' }}>
            <Split h="100%">
              <Split.Pane grow>
                <Stack gap="0" w="100%" h="100%" bg="var(--bg-base)" bd="0.5px solid var(--mantine-color-gray-4)">
                  <WorkbookTabBar />
                  <MainContent.Body p="0">{content}</MainContent.Body>
                  {contentFooter && <MainContent.Footer h={28}>{contentFooter}</MainContent.Footer>}
                </Stack>
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              <Split.Pane initialWidth={DEFAULT_CHAT_WIDTH} minWidth={MIN_CHAT_WIDTH} maxWidth={MAX_CHAT_WIDTH}>
                <AIChatPanel />
              </Split.Pane>
            </Split>
          </Box>
        ) : (
          <Box p="0 6 6 6" w="100%" h="calc(100vh - 36px)">
            <Stack gap="0" w="100%" h="100%" bg="var(--bg-base)" bd="0.5px solid var(--mantine-color-gray-4)">
              <WorkbookTabBar />
              <MainContent.Body p="0">{content}</MainContent.Body>
              {contentFooter && <MainContent.Footer h={28}>{contentFooter}</MainContent.Footer>}
            </Stack>
          </Box>
        )}
      </MainContent>

      {/* Workbook Scoped Modals and workflow components */}
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

export default function WorkbookPage() {
  const params = useWorkbookParams();

  // Top level logic for managing the workbook editor UI state.
  const openWorkbook = useWorkbookEditorUIStore((state) => state.openWorkbook);
  const closeWorkbook = useWorkbookEditorUIStore((state) => state.closeWorkbook);
  const reconcileWithWorkbook = useWorkbookEditorUIStore((state) => state.reconcileWithWorkbook);
  const closeNavDrawer = useLayoutManagerStore((state) => state.closeNavDrawer);

  // Workbook WebSocket store connection
  const connectWorkbookWebSocket = useWorkbookWebSocketStore((state) => state.connect);
  const disconnectWorkbookWebSocket = useWorkbookWebSocketStore((state) => state.disconnect);

  useEffect(() => {
    openWorkbook(params);

    return () => {
      closeWorkbook();
      closeNavDrawer();
    };
    // Only depend on the changing value for workbook id, no the params object reference which changes with each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.workbookId, openWorkbook, closeWorkbook, closeNavDrawer]);

  // Connect to workbook WebSocket for this workbook
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
          <WorkbookPageContent />
          <PublishWorkbookWorkflow />
          <WorkbookEditorModals />
        </UpdateRecordsProvider>
      </AIAgentSessionManagerProvider>
    </AgentChatContextProvider>
  );
}
