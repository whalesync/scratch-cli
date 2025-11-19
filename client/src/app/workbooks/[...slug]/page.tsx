'use client';

import { ArrowLeftIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import AIChatPanel from './components/AIChatPanel/AIChatPanel';

import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { ErrorInfo } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { AgentChatContextProvider } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { SnapshotEventProvider } from '@/app/workbooks/[...slug]/components/contexts/snapshot-event-context';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { useDevTools } from '@/hooks/use-dev-tools';
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import { Box, Group, Stack } from '@mantine/core';
import _ from 'lodash';
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
import SnapshotGrid from './components/snapshot-grid/SnapshotGrid';
import { WorkbookHeader } from './components/WorkbookHeader';
import { WorkbookTabBar } from './components/WorkbookTabBar';
import { useWorkbookParams } from './hooks/use-workbook-params';

const CONTENT_CHAT_SPACING = '6px';
const DEFAULT_CHAT_WIDTH = '500px';

function WorkbookPageContent() {
  const { isDevToolsEnabled } = useDevTools();
  const { tableId, updateSnapshotPath } = useWorkbookParams();
  const { activeTable } = useActiveWorkbook();
  const activeTab = useWorkbookEditorUIStore((state) => state.activeTab);
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const devToolsOpen = useWorkbookEditorUIStore((state) => state.devToolsOpen);
  const closeDevTools = useWorkbookEditorUIStore((state) => state.closeDevTools);
  const chatOpen = useWorkbookEditorUIStore((state) => state.chatOpen);
  const router = useRouter();
  const { workbook, isLoading, refreshWorkbook } = useActiveWorkbook();

  const [showManageTablesModal, setShowManageTablesModal] = useState(false);

  useEffect(() => {
    if (!activeTable) {
      return;
    }
    // check to see if the content of the active table has changed and reset the object if it has, to trigger re-render of the grid
    const updatedTable = getSnapshotTables(workbook).find((t) => t.id === activeTable.id);
    if (
      updatedTable &&
      (!_.isEqual(activeTable.tableSpec, updatedTable.tableSpec) ||
        !_.isEqual(activeTable.columnSettings, updatedTable.columnSettings))
    ) {
      // update the active table and table context with the newer version
      setActiveTab(updatedTable.id);
    }
  }, [workbook, activeTable, tableId, updateSnapshotPath, setActiveTab]);

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

  const [contentWidth, chatWidth] = useMemo(() => {
    if (activeTable && chatOpen) {
      return [`calc(100vw - ${DEFAULT_CHAT_WIDTH} - ${CONTENT_CHAT_SPACING})`, DEFAULT_CHAT_WIDTH];
    }
    // set width to 0px instead of unmounting so it still renders and can run AI tasks in the background
    return ['100%', '0px'];
  }, [activeTable, chatOpen]);

  // Only show loader on initial load, not during revalidation
  if (isLoading && !workbook) {
    return <LoaderWithMessage centered message="Loading workbook..." />;
  }

  if (!workbook) {
    return (
      <ErrorInfo
        title="Workbook not found."
        error="We were unable to find the workbook you are looking for."
        action={
          <ButtonPrimaryLight leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.workbooksPageUrl)}>
            Return to workbooks
          </ButtonPrimaryLight>
        }
      />
    );
  }

  const allTables = getSnapshotTables(workbook, true); // Include hidden tables
  const aiChatPanel = activeTable ? (
    <Box w={chatWidth} h="100%">
      <AIChatPanel activeTable={activeTable} />
    </Box>
  ) : null;

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
        <Group p="0 6 6 6" gap={CONTENT_CHAT_SPACING} w="100%" h="calc(100vh - 36px)" wrap="nowrap" align="flex-start">
          <Stack gap="0" w={contentWidth} h="100%" bg="var(--bg-base)" bd="1px solid var(--mantine-color-gray-4)">
            <WorkbookTabBar />
            <MainContent.Body p="0">{content}</MainContent.Body>
            {contentFooter && <MainContent.Footer h={28}>{contentFooter}</MainContent.Footer>}
          </Stack>
          {aiChatPanel}
        </Group>
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
      <PublishWorkbookWorkflow />

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

  useEffect(() => {
    openWorkbook(params);
    return () => {
      closeWorkbook();
      closeNavDrawer();
    };
  }, [params, openWorkbook, closeWorkbook, closeNavDrawer]);

  const { workbook } = useWorkbook(params.workbookId);
  useEffect(() => {
    if (workbook) {
      reconcileWithWorkbook(workbook);
    }
  }, [workbook, reconcileWithWorkbook]);

  return (
    <AgentChatContextProvider workbookId={params.workbookId}>
      <SnapshotEventProvider workbookId={params.workbookId}>
        <AIAgentSessionManagerProvider workbookId={params.workbookId}>
          <UpdateRecordsProvider>
            <WorkbookPageContent />
          </UpdateRecordsProvider>
        </AIAgentSessionManagerProvider>
      </SnapshotEventProvider>
    </AgentChatContextProvider>
  );
}
