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
import { RouteUrls } from '@/utils/route-urls';
import { getSnapshotTables } from '@/utils/snapshot-helpers';
import { Stack } from '@mantine/core';
import _ from 'lodash';
import { useEffect, useState } from 'react';
import { useActiveWorkbook } from '../../../hooks/use-active-workbook';
import { useWorkbook } from '../../../hooks/use-workbook';
import { useWorkbookEditorUIStore } from '../../../stores/workbook-editor-store';
import { AddTableTab } from './components/AddTableTab';
import { UpdateRecordsProvider } from './components/contexts/update-records-context';
import { ManageTablesModal } from './components/ManageTablesModal';
import { RecordDataToolbar } from './components/RecordDataToolbar';
import SnapshotGrid from './components/snapshot-grid/SnapshotGrid';
import { WorkbookHeader } from './components/WorkbookHeader';
import { WorkbookTabBar } from './components/WorkbookTabBar';
import { useWorkbookParams } from './hooks/use-workbook-params';

function SnapshotPageContent() {
  const { tableId, updateSnapshotPath } = useWorkbookParams();
  const { activeTable } = useActiveWorkbook();
  const activeTab = useWorkbookEditorUIStore((state) => state.activeTab);
  const setActiveTab = useWorkbookEditorUIStore((state) => state.setActiveTab);

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
        alert('Hot key not implemented yet, use the publish button instead');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const aiChatPanel = activeTable ? <AIChatPanel activeTable={activeTable} /> : null;

  let content = null;
  let contentFooter = null;
  if (workbook) {
    if (activeTable) {
      content = <SnapshotGrid workbook={workbook} table={activeTable} />;
      contentFooter = <RecordDataToolbar table={activeTable} />;
    } else if (activeTab?.startsWith('new-tab')) {
      content = <AddTableTab />;
    }
  }
  return (
    <PageLayout pageTitle={workbook.name ?? 'Workbook'} rightPanel={aiChatPanel}>
      <MainContent>
        <Stack gap="0">
          <WorkbookHeader />
          <WorkbookTabBar />
        </Stack>
        <MainContent.Body p="0">{content}</MainContent.Body>
        {contentFooter && <MainContent.Footer>{contentFooter}</MainContent.Footer>}
      </MainContent>

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
    </PageLayout>
  );
}

export default function WorkbookPage() {
  const params = useWorkbookParams();

  // Top level logic for managing the workbook editor UI state.
  const openWorkbook = useWorkbookEditorUIStore((state) => state.openWorkbook);
  const closeWorkbook = useWorkbookEditorUIStore((state) => state.closeWorkbook);
  const reconcileWithWorkbook = useWorkbookEditorUIStore((state) => state.reconcileWithWorkbook);

  useEffect(() => {
    openWorkbook(params);
    return () => closeWorkbook();
  }, [params, openWorkbook, closeWorkbook]);

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
            <SnapshotPageContent />
          </UpdateRecordsProvider>
        </AIAgentSessionManagerProvider>
      </SnapshotEventProvider>
    </AgentChatContextProvider>
  );
}
