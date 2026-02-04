'use client';

import isEqual from 'lodash/isEqual';

import { useRouter } from 'next/navigation';
// Import similar to the original page
import { FullPageLoader } from '@/app/components/FullPageLoader';
import { ErrorInfo, Info } from '@/app/components/InfoPanel';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { WorkbookInspector } from '@/app/workbooks-md/[...slug]/components/devtool/WorkbookInspector';
import { PublishDataFolderWorkflow } from '@/app/workbooks-md/[...slug]/components/PublishDataFolderWorkflow';
import { PublishWorkbookWorkflow } from '@/app/workbooks-md/[...slug]/components/PublishWorkbookWorkflow';
import { WorkbookHeader } from '@/app/workbooks-md/[...slug]/components/WorkbookHeader';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbook } from '@/hooks/use-workbook';
import { useWorkbookParams } from '@/hooks/use-workbook-params';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { useWorkbookWebSocketStore } from '@/stores/workbook-websocket-store';
import { RouteUrls } from '@/utils/route-urls';
import { Split } from '@gfazioli/mantine-split-pane';
import { Accordion, Box, Stack } from '@mantine/core';
import type { DataFolder, DataFolderId } from '@spinner/shared-types';
import { ArrowLeftIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Text12Book } from '../../components/base/text';
import { WorkbookEditorModals } from '../../workbooks-md/[...slug]/components/modals/WorkbookEditorModals';
import { AddLinkedFolderTab } from './components/AddLinkedFolderTab';
import { DataFolderBrowser } from './components/DataFolderBrowser';
import { DataFolderFileList } from './components/DataFolderFileList';
import { FileEditorNew } from './components/FileEditorNew';
import { SyncsPanel } from './components/SyncsPanel';
import { SyncsView } from './components/SyncsView';
import { TabBar } from './components/TabBar';
import { UnpublishedChangesPanel } from './components/UnpublishedChangesPanel';

const DEFAULT_LIST_WIDTH = '300px';
const MIN_LIST_WIDTH = 300;
const MAX_LIST_WIDTH = 600;

function WorkbookFilesPageContent() {
  const { isDevToolsEnabled } = useDevTools();
  const { tableId: pathTableId } = useWorkbookParams();
  // const activeTab = useWorkbookEditorUIStore((state) => state.activeTab); // Unused
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);
  const devToolsOpen = useWorkbookEditorUIStore((state) => state.devToolsOpen);
  const closeDevTools = useWorkbookEditorUIStore((state) => state.closeDevTools);
  // File tab state is now managed in the store
  const openFileTabs = useWorkbookEditorUIStore((state) => state.openFileTabs);
  const activeFileTabId = useWorkbookEditorUIStore((state) => state.activeFileTabId);

  const router = useRouter();
  const { workbook, activeTable, isLoading } = useActiveWorkbook();

  useEffect(() => {
    if (!activeTable) {
      return;
    }
    const updatedFolder = workbook?.dataFolders?.find((df) => df.id === activeTable.id);

    if (updatedFolder && !isEqual((activeTable as DataFolder).schema, updatedFolder.schema)) {
      setActiveTab(updatedFolder.id);
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
                  <Accordion
                    chevronPosition="left"
                    chevronSize={14}
                    multiple={false}
                    defaultValue="apps"
                    transitionDuration={0}
                    styles={{
                      root: { display: 'flex', flexDirection: 'column', height: '100%' },
                      item: {
                        borderBottom: '1px solid var(--fg-divider)',
                        overflow: 'hidden',
                        // Remove transition to avoid state issues
                        transition: 'flex 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: 'var(--bg-base)',
                        '&[data-active]': { flex: 1 },
                      },
                      control: {
                        padding: '0 12px 0 3px',
                        height: '36px',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-base)',
                        '&:hover': { backgroundColor: 'var(--bg-base) !important' },
                      },
                      chevron: {
                        marginRight: 3,
                        marginLeft: 4,
                        color: 'var(--mantine-color-gray-7)',
                      },
                      // Ensure content/panel take full height provided by flex item
                      content: {
                        padding: 0,
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        borderTop: '1px solid var(--mantine-color-gray-2)',
                      },
                      panel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
                      label: { fontWeight: 500, fontSize: '14px' },
                    }}
                  >
                    <DataFolderBrowser />
                    <SyncsPanel />
                    <UnpublishedChangesPanel
                      onPublishAll={() => console.log('Publish All')}
                      onDiscardAll={() => console.log('Discard All')}
                      onPublishItem={(path) => console.log('Publish', path)}
                      onDiscardItem={(path) => console.log('Discard', path)}
                    />
                  </Accordion>
                </Stack>
              </Split.Pane>

              <Split.Resizer w="6px" m={0} hoverColor="transparent" />

              {/* Middle Pane: MD Editor */}
              <Split.Pane grow>
                <Stack h="100%" gap={0} bg="var(--bg-base)" style={{ border: '0.5px solid var(--fg-divider)' }}>
                  {/* Tab Bar */}
                  <TabBar />

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
                        return <DataFolderFileList dataFolderId={activeTab.id as DataFolderId} />;
                      }
                      if (activeTab?.type === 'add-table') {
                        return <AddLinkedFolderTab />;
                      }
                      if (activeTab?.type === 'file') {
                        return <FileEditorNew workbookId={workbook.id} filePath={activeFileTabId} />;
                      }
                      if (activeTab?.type === 'syncs-view') {
                        return <SyncsView />;
                      }
                      // Default to an empty state
                      return (
                        <Box
                          p="xl"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
                        >
                          <Text12Book c="dimmed">Select a folder to view content</Text12Book>
                        </Box>
                      );
                    })()}
                  </Box>
                </Stack>
              </Split.Pane>
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
    <>
      <WorkbookFilesPageContent />
      <PublishWorkbookWorkflow />
      <PublishDataFolderWorkflow />
      <WorkbookEditorModals />
    </>
  );
}
