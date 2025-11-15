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
import { useActiveSnapshot } from '../../../hooks/use-active-snapshot';
import { useSnapshot } from '../../../hooks/use-snapshot';
import { useSnapshotEditorUIStore } from '../../../stores/snapshot-editor-store';
import { AddTableTab } from './components/AddTableTab';
import { UpdateRecordsProvider } from './components/contexts/update-records-context';
import { ManageTablesModal } from './components/ManageTablesModal';
import { RecordDataToolbar } from './components/RecordDataToolbar';
import SnapshotGrid from './components/snapshot-grid/SnapshotGrid';
import { SnapshotHeader } from './components/SnapshotHeader';
import { SnapshotTabBar } from './components/SnapshotTabBar';
import { useSnapshotParams } from './hooks/use-snapshot-params';

function SnapshotPageContent() {
  const { tableId, updateSnapshotPath } = useSnapshotParams();
  const { activeTable } = useActiveSnapshot();
  const activeTab = useSnapshotEditorUIStore((state) => state.activeTab);
  const setActiveTab = useSnapshotEditorUIStore((state) => state.setActiveTab);

  const router = useRouter();
  const { snapshot, isLoading, refreshSnapshot } = useActiveSnapshot();

  const [showManageTablesModal, setShowManageTablesModal] = useState(false);

  useEffect(() => {
    if (!activeTable) {
      return;
    }
    // check to see if the content of the active table has changed and reset the object if it has, to trigger re-render of the grid
    const updatedTable = getSnapshotTables(snapshot).find((t) => t.tableSpec.id.wsId === activeTable.tableSpec.id.wsId);
    if (
      updatedTable &&
      (!_.isEqual(activeTable.tableSpec, updatedTable.tableSpec) ||
        !_.isEqual(activeTable.columnSettings, updatedTable.columnSettings))
    ) {
      // update the active table and table context with the newer version
      setActiveTab(updatedTable.id);
    }
  }, [snapshot, activeTable, tableId, updateSnapshotPath, setActiveTab]);

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
  if (isLoading && !snapshot) {
    return <LoaderWithMessage centered message="Loading snapshot..." />;
  }

  if (!snapshot) {
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

  const allTables = getSnapshotTables(snapshot, true); // Include hidden tables
  const aiChatPanel = activeTable ? <AIChatPanel activeTable={activeTable} /> : null;

  let content = null;
  let contentFooter = null;
  if (snapshot) {
    if (activeTable) {
      content = <SnapshotGrid snapshot={snapshot} table={activeTable} />;
      contentFooter = <RecordDataToolbar table={activeTable.tableSpec} />;
    } else if (activeTab?.startsWith('new-tab')) {
      content = <AddTableTab />;
    }
  }
  return (
    <PageLayout pageTitle={snapshot.name ?? 'Workbook'} rightPanel={aiChatPanel}>
      <MainContent>
        <Stack gap="0">
          <SnapshotHeader />
          <SnapshotTabBar />
        </Stack>
        <MainContent.Body p="0">{content}</MainContent.Body>
        {contentFooter && <MainContent.Footer>{contentFooter}</MainContent.Footer>}
      </MainContent>

      <ManageTablesModal
        isOpen={showManageTablesModal}
        onClose={() => setShowManageTablesModal(false)}
        onSave={async () => {
          if (refreshSnapshot) {
            await refreshSnapshot();
          }
        }}
        snapshotId={snapshot.id}
        tables={allTables}
      />
    </PageLayout>
  );
}

export default function SnapshotPage() {
  const params = useSnapshotParams();

  // Top level logic for managing the snapshot editor UI state.
  const openSnapshot = useSnapshotEditorUIStore((state) => state.openSnapshot);
  const closeSnapshot = useSnapshotEditorUIStore((state) => state.closeSnapshot);
  const reconcileWithSnapshot = useSnapshotEditorUIStore((state) => state.reconcileWithSnapshot);

  useEffect(() => {
    openSnapshot(params);
    return () => closeSnapshot();
  }, [params, openSnapshot, closeSnapshot]);

  const { snapshot } = useSnapshot(params.snapshotId);
  useEffect(() => {
    if (snapshot) {
      reconcileWithSnapshot(snapshot);
    }
  }, [snapshot, reconcileWithSnapshot]);

  return (
    <AgentChatContextProvider snapshotId={params.snapshotId}>
      <SnapshotEventProvider snapshotId={params.snapshotId}>
        <AIAgentSessionManagerProvider snapshotId={params.snapshotId}>
          <UpdateRecordsProvider>
            <SnapshotPageContent />
          </UpdateRecordsProvider>
        </AIAgentSessionManagerProvider>
      </SnapshotEventProvider>
    </AgentChatContextProvider>
  );
}
