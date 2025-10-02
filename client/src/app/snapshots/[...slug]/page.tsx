'use client';

import { SnapshotProvider, useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { SnapshotTableContext } from '@/types/server-entities/snapshot';
import { ActionIcon, Group, Modal, ScrollArea, useModalsStack } from '@mantine/core';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { PanelRightIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AIChatPanel from './components/AIChatPanel/AIChatPanel';

import { PrimaryButton } from '@/app/components/base/buttons';
import { TextTitleXs } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ErrorInfo } from '@/app/components/InfoPanel';
import JsonTreeViewer from '@/app/components/JsonTreeViewer';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { NavbarToggleButton } from '@/app/components/NavbarToggleButton';
import { AgentChatContextProvider } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { SnapshotEventProvider } from '@/app/snapshots/[...slug]/components/contexts/snapshot-event-context';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { tablesName } from '@/service-naming-conventions';
import { useLayoutManagerStore } from '@/stores/layout-manager-store';
import { Service } from '@/types/server-entities/connector-accounts';
import { RouteUrls } from '@/utils/route-urls';
import '@glideapps/glide-data-grid/dist/index.css';
import { useEffect, useState } from 'react';
import { TableProvider, useTableContext } from './components/contexts/table-context';
import { RecordDataToolbar } from './components/RecordDataToolbar';
import SnapshotGrid from './components/snapshot-grid/SnapshotGrid';
import { SnapshotActionsMenu } from './components/SnapshotActionsMenu';
import { useSnapshotParams } from './hooks/use-snapshot-params';

function SnapshotPageContent() {
  const { tableId, updateSnapshotPath } = useSnapshotParams();
  const {
    activeTable,
    setActiveTable,
    // switchDisplayMode,
    // displayMode,
    // switchToSpreadsheetView,
    // switchToRecordView,
    // switchToNewSpreadsheetView,
  } = useTableContext();
  const router = useRouter();
  const { rightPanelOpened, toggleRightPanel } = useLayoutManagerStore();

  const { snapshot, isLoading } = useSnapshotContext();

  const [selectedTableContext, setSelectedTableContext] = useState<SnapshotTableContext | null>(null);
  const modalStack = useModalsStack(['tableSpecDebug', 'tableContextDebug', 'snapshotEventLog']);

  // Get count information for the current table
  // const { records } = useSnapshotTableRecords({
  //   snapshotId: id,
  //   tableId: activeTable ? activeTable.id.wsId : '',
  //   viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  // });

  useEffect(() => {
    if (!activeTable) {
      if (tableId) {
        const table = snapshot?.tables.find((t) => t.id.wsId === tableId);
        if (table) {
          setActiveTable(table);
          setSelectedTableContext(snapshot?.tableContexts.find((t) => t.id.wsId === tableId) ?? null);
        }
      } else {
        setActiveTable(snapshot?.tables[0] ?? undefined);
        setSelectedTableContext(snapshot?.tableContexts[0] ?? null);
      }
    }
  }, [snapshot, activeTable, tableId, updateSnapshotPath, setActiveTable, setSelectedTableContext]);

  // Only show loader on initial load, not during revalidation
  if (isLoading && !snapshot) {
    return <LoaderWithMessage message="Loading snapshot..." />;
  }

  if (!snapshot) {
    return (
      <ErrorInfo
        title="Scratchpaper not found."
        error="We were unable to find the scratchpaper you are looking for."
        action={
          <PrimaryButton leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.snapshotsPageUrl)}>
            Return to scratchpapers
          </PrimaryButton>
        }
      />
    );
  }

  if (snapshot.tables.length === 0) {
    return (
      <ErrorInfo
        title={`No ${tablesName(snapshot.connectorService as Service)} found in ${snapshot.name}`}
        error={`There are no ${tablesName(snapshot.connectorService as Service)} in this scratchpaper. You will need to abandon the scratchpaper and recreate it.`}
        action={
          <PrimaryButton leftSection={<ArrowLeftIcon />} onClick={() => router.push(RouteUrls.snapshotsPageUrl)}>
            Return to scratchpapers
          </PrimaryButton>
        }
      />
    );
  }

  const debugModals = (
    <>
      {activeTable && (
        <Modal {...modalStack.register('tableSpecDebug')} title={`TableSpec for ${activeTable?.name}`} size="lg">
          <ScrollArea h={500}>
            <JsonTreeViewer jsonData={activeTable} expandAll={true} />
          </ScrollArea>
        </Modal>
      )}
      {activeTable && (
        <Modal
          {...modalStack.register('tableContextDebug')}
          title={`Table Context settings for ${activeTable?.name}`}
          size="lg"
        >
          <ScrollArea h={500}>
            <JsonTreeViewer jsonData={selectedTableContext ?? {}} expandAll={true} />
          </ScrollArea>
        </Modal>
      )}
    </>
  );

  const header = (
    <Group align="center" h="100%">
      <Group>
        <NavbarToggleButton />
        <Group gap="xs">
          <ConnectorIcon connector={snapshot.connectorService} size={24} />
          <TextTitleXs>{snapshot.name}</TextTitleXs>
        </Group>
        {/* <Group gap="2px">
          <Button
            variant={displayMode === 'spreadsheet' ? 'outline' : 'transparent'}
            size="xs"
            leftSection={<Table size={12} />}
            onClick={() => switchToSpreadsheetView()}
            c={displayMode === 'spreadsheet' ? 'gray.7' : 'gray.5'}
            color={displayMode === 'spreadsheet' ? 'gray.7' : 'gray.5'}
          >
            Table
          </Button>
          <Button
            variant={displayMode === 'record' ? 'outline' : 'transparent'}
            size="xs"
            leftSection={<FileText size={12} />}
            onClick={() => switchToRecordView(records?.[0]?.id.wsId ?? '')}
            c={displayMode === 'record' ? 'gray.7' : 'gray.5'}
            color={displayMode === 'record' ? 'gray.7' : 'gray.5'}
          >
            Record
          </Button>
          <Button
            variant={displayMode === 'new-spreadsheet' ? 'outline' : 'transparent'}
            size="xs"
            leftSection={<Table size={12} />}
            onClick={() => switchToNewSpreadsheetView()}
            c={displayMode === 'new-spreadsheet' ? 'gray.7' : 'gray.5'}
            color={displayMode === 'new-spreadsheet' ? 'gray.7' : 'gray.5'}
          >
            New Table
          </Button>
        </Group> */}
      </Group>

      <Group ml="auto" gap="xs" align="center">
        <SnapshotActionsMenu />
        {!rightPanelOpened && (
          <ActionIcon variant="transparent-hover" onClick={toggleRightPanel} color="gray">
            <StyledLucideIcon Icon={PanelRightIcon} size={14} />
          </ActionIcon>
        )}
      </Group>
    </Group>
  );

  const aiChatPanel = activeTable ? <AIChatPanel activeTable={activeTable} /> : null;

  let content = null;
  let contentFooter = null;
  if (snapshot && activeTable) {
    content = <SnapshotGrid snapshot={snapshot} table={activeTable} />;
    contentFooter = <RecordDataToolbar table={activeTable} />;
  }

  return (
    <PageLayout pageTitle={snapshot.name ?? 'Scratchpaper'} rightPanel={aiChatPanel}>
      <MainContent>
        <MainContent.Header>{header}</MainContent.Header>
        <MainContent.Body p="0">
          {content}
          {debugModals}
        </MainContent.Body>
        {contentFooter && <MainContent.Footer>{contentFooter}</MainContent.Footer>}
      </MainContent>
    </PageLayout>
  );
}

export default function SnapshotPage() {
  const { snapshotId: id } = useSnapshotParams();

  return (
    <AgentChatContextProvider snapshotId={id}>
      <SnapshotProvider snapshotId={id}>
        <SnapshotEventProvider snapshotId={id}>
          <AIAgentSessionManagerProvider snapshotId={id}>
            <TableProvider>
              <SnapshotPageContent />
            </TableProvider>
          </AIAgentSessionManagerProvider>
        </SnapshotEventProvider>
      </SnapshotProvider>
    </AgentChatContextProvider>
  );
}
