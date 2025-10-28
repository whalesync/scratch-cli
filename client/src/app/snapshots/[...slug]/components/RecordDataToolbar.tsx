'use client';

import { ContentFooterButton } from '@/app/components/base/buttons';
import { TextSmBook, TextXsRegular } from '@/app/components/base/text';
import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { KeyboardShortcutHelpModal } from '@/app/components/KeyboardShortcutHelpModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { snapshotApi } from '@/lib/api/snapshot';
import { TableSpec } from '@/types/server-entities/snapshot';
import { Box, Button, Group, Menu, Modal, Textarea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FunnelSimpleIcon, LineVerticalIcon, PlusIcon } from '@phosphor-icons/react';
import { BugIcon, HelpCircleIcon } from 'lucide-react';
import pluralize from 'pluralize';
import { useCallback, useEffect, useState } from 'react';
import { useSnapshotContext } from './contexts/SnapshotContext';
import { SnapshotEventDebugDialog } from './devtool/SnapshotEventDebugDialog';

interface RecordDataToolbarProps {
  table: TableSpec;
}

export const RecordDataToolbar = (props: RecordDataToolbarProps) => {
  const { table } = props;
  const { snapshot, currentViewId, viewDataAsAgent, clearActiveRecordFilter } = useSnapshotContext();
  const { isDevToolsEnabled } = useDevTools();
  const [helpOverlayOpen, { open: openHelpOverlay, close: closeHelpOverlay }] = useDisclosure(false);
  const [
    snapshotEventDebugDialogOpen,
    { toggle: toggleSnapshotEventDebugDialog, close: closeSnapshotEventDebugDialog },
  ] = useDisclosure(false);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'h') {
        event.preventDefault();
        openHelpOverlay();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openHelpOverlay]);

  const { count, filteredCount, createNewRecord } = useSnapshotTableRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: table.id.wsId,
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });

  // Local state
  const [sqlFilterModalOpen, setSqlFilterModalOpen] = useState(false);
  const [sqlFilterText, setSqlFilterText] = useState('');
  const [sqlFilterError, setSqlFilterError] = useState<string | null>(null);

  const currentTableFilter =
    table.id.wsId && snapshot && snapshot.activeRecordSqlFilter && table.id.wsId in snapshot.activeRecordSqlFilter
      ? snapshot.activeRecordSqlFilter[table.id.wsId]
      : undefined;

  useEffect(() => {
    if (sqlFilterModalOpen) {
      setSqlFilterText(currentTableFilter || '');
      setSqlFilterError(null); // Clear any previous errors
    }
  }, [sqlFilterModalOpen, currentTableFilter]);

  const handleSetSqlFilter = useCallback(async () => {
    if (!table.id.wsId || !snapshot) return;

    setSqlFilterError(null); // Clear any previous errors

    try {
      await snapshotApi.setActiveRecordsFilter(snapshot.id, table.id.wsId, sqlFilterText || undefined);
      ScratchpadNotifications.success({
        title: 'Filter Updated',
        message: 'SQL filter has been applied',
      });
      setSqlFilterModalOpen(false);
      setSqlFilterText('');
    } catch (error) {
      console.error('Error setting SQL filter:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set SQL filter';
      setSqlFilterError(errorMessage);
    }
  }, [table.id.wsId, snapshot, sqlFilterText]);

  return (
    <>
      <Group justify="flex-start" align="center" h="100%">
        <Group gap="2px">
          <ContentFooterButton leftSection={<PlusIcon size={16} />} onClick={createNewRecord}>
            Add Row
          </ContentFooterButton>
          <StyledIcon Icon={LineVerticalIcon} c="gray.6" size="xs" />
          <Menu shadow="md" width={250}>
            <Menu.Target>
              <ContentFooterButton leftSection={<FunnelSimpleIcon size={16} />}>Filter</ContentFooterButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setSqlFilterModalOpen(true)}>Set SQL Filter</Menu.Item>
              <Menu.Item
                disabled={!currentTableFilter}
                onClick={() => table.id.wsId && clearActiveRecordFilter(table.id.wsId)}
              >
                Clear Filter
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Group ml="auto" gap="xs" align="center">
          {count !== undefined && (
            <>
              <TextSmBook>{`${filteredCount} ${pluralize('record', filteredCount)}`}</TextSmBook>
              {filteredCount !== undefined && count > filteredCount && (
                <TextSmBook>({`${count - filteredCount} filtered`})</TextSmBook>
              )}
            </>
          )}
          {isDevToolsEnabled && (
            <ToolIconButton
              icon={BugIcon}
              onClick={toggleSnapshotEventDebugDialog}
              size="md"
              tooltip="Dev Tool: Toggle snapshot event log"
            />
          )}
          <ToolIconButton icon={HelpCircleIcon} onClick={openHelpOverlay} size="md" />
        </Group>
      </Group>
      {/* SQL Filter Modal */}
      <Modal opened={sqlFilterModalOpen} onClose={() => setSqlFilterModalOpen(false)} title="Set SQL Filter" size="md">
        <Box>
          <TextXsRegular>Enter a SQL WHERE clause to filter records. Leave empty to clear the filter.</TextXsRegular>
          <TextXsRegular size="xs" c="dimmed" mb="md">
            Example: name = &apos;John&apos; AND age &gt; 25
          </TextXsRegular>
          <Textarea
            label="SQL WHERE Clause"
            value={sqlFilterText}
            onChange={(e) => {
              setSqlFilterText(e.target.value);
              if (sqlFilterError) {
                setSqlFilterError(null); // Clear error when user starts typing
              }
            }}
            placeholder="Enter SQL WHERE clause..."
            minRows={3}
            error={sqlFilterError}
            mb="md"
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setSqlFilterModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSetSqlFilter} loading={false}>
              Apply Filter
            </Button>
          </Group>
        </Box>
      </Modal>
      <SnapshotEventDebugDialog opened={snapshotEventDebugDialogOpen} onClose={closeSnapshotEventDebugDialog} />
      <KeyboardShortcutHelpModal opened={helpOverlayOpen} onClose={closeHelpOverlay} />
    </>
  );
};
