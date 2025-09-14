'use client';

import { SnapshotProvider, useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { SnapshotTableContext } from '@/types/server-entities/snapshot';
import { Button, Group, Modal, ScrollArea, useModalsStack } from '@mantine/core';
import { ArrowLeftIcon, FileTextIcon, TableIcon } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import AIChatPanel from './components/AIChatPanel/AIChatPanel';

import { PrimaryButton } from '@/app/components/base/buttons';
import { TextTitleXs } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ErrorInfo } from '@/app/components/InfoPanel';
import JsonTreeViewer from '@/app/components/JsonTreeViewer';
import MainContent from '@/app/components/layouts/MainContent';
import { PageLayout } from '@/app/components/layouts/PageLayout';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { NavToggle } from '@/app/components/NavbarToggle';
import { AgentChatContextProvider } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { SnapshotEventProvider } from '@/app/snapshots/[...slug]/components/contexts/snapshot-event-context';
import { AIAgentSessionManagerProvider } from '@/contexts/ai-agent-session-manager-context';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { tablesName } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { RouteUrls } from '@/utils/route-urls';
import '@glideapps/glide-data-grid/dist/index.css';
import { useDisclosure } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import { TableProvider, useTableContext } from './components/contexts/table-context';
import { RecordView } from './components/RecordView';
import SnapshotTableGrid from './components/snapshot-table/SnapshotTableGrid';
import { SnapshotActionsMenu } from './components/SnapshotActionsMenu';
import { ViewData } from './components/ViewData';
import { useSnapshotParams } from './hooks/use-snapshot-params';

function SnapshotPageContent() {
  const { snapshotId: id, tableId, updateSnapshotPath } = useSnapshotParams();
  const { activeTable, setActiveTable, displayMode, switchToSpreadsheetView, switchToRecordView } = useTableContext();
  const router = useRouter();

  const { snapshot, isLoading, currentViewId, viewDataAsAgent } = useSnapshotContext();
  const [showChat, { toggle: toggleChat }] = useDisclosure(true);

  const [selectedTableContext, setSelectedTableContext] = useState<SnapshotTableContext | null>(null);
  const modalStack = useModalsStack(['tableSpecDebug', 'tableContextDebug', 'snapshotEventLog']);

  // Get count information for the current table
  const { records, count, filteredCount } = useSnapshotTableRecords({
    snapshotId: id,
    tableId: activeTable ? activeTable.id.wsId : '',
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });

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
        <NavToggle />
        <Group gap="xs">
          <ConnectorIcon connector={Service.NOTION} size={24} />
          <TextTitleXs>{snapshot.name}</TextTitleXs>
        </Group>
        <Group gap="2px">
          <Button
            variant={displayMode === 'spreadsheet' ? 'outline' : 'transparent'}
            size="xs"
            leftSection={<TableIcon size={12} />}
            onClick={() => switchToSpreadsheetView()}
            c={displayMode === 'spreadsheet' ? 'gray.7' : 'gray.5'}
            color={displayMode === 'spreadsheet' ? 'gray.7' : 'gray.5'}
          >
            Table
          </Button>

          <Button
            variant={displayMode === 'record' ? 'outline' : 'transparent'}
            size="xs"
            leftSection={<FileTextIcon size={12} />}
            onClick={() => switchToRecordView(records?.[0]?.id.wsId ?? '')}
            c={displayMode === 'record' ? 'gray.7' : 'gray.5'}
            color={displayMode === 'record' ? 'gray.7' : 'gray.5'}
          >
            Record
          </Button>
        </Group>
      </Group>

      <Group ml="auto" gap="xs" align="center">
        <SnapshotActionsMenu aiChatOpen={showChat} onChatToggle={toggleChat} />
      </Group>
    </Group>
  );

  const aiChatPanel = activeTable ? (
    <AIChatPanel isOpen={showChat} onClose={toggleChat} activeTable={activeTable} />
  ) : null;
  // const footer = (
  //   <Group justify="flex-start" align="center" h="100%">
  //     Footer - TODO
  //   </Group>
  // );

  let content = null;
  if (snapshot && activeTable) {
    content =
      displayMode === 'spreadsheet' ? (
        <SnapshotTableGrid snapshot={snapshot} table={activeTable} />
      ) : (
        <RecordView table={activeTable} />
      );
  }

  return (
    <PageLayout pageTitle={snapshot.name ?? 'Scratchpaper'} rightPanel={aiChatPanel}>
      <MainContent>
        <MainContent.Header>{header}</MainContent.Header>
        <MainContent.Body p="0">
          {content}
          {debugModals}
        </MainContent.Body>
        <MainContent.Footer>
          <ViewData currentTableId={activeTable?.id.wsId} count={count} filteredCount={filteredCount} />
        </MainContent.Footer>
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
