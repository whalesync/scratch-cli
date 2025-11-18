'use client';

import { ContentFooterButton } from '@/app/components/base/buttons';
import { Text12Regular, Text13Book } from '@/app/components/base/text';
import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { KeyboardShortcutHelpModal } from '@/app/components/KeyboardShortcutHelpModal';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolIconButton } from '@/app/components/ToolIconButton';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { SWR_KEYS } from '@/lib/api/keys';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotTable } from '@/types/server-entities/workbook';
import {
  calculateTokensForRecords,
  formatTokenCount,
  TokenCalculation,
  tokenCalculationSymbol,
} from '@/utils/token-counter';
import { Box, Button, Group, Menu, Modal, Textarea, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { FunnelSimpleIcon, LineVerticalIcon, PlusIcon } from '@phosphor-icons/react';
import { BugIcon, HelpCircleIcon } from 'lucide-react';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import { useAgentChatContext } from './contexts/agent-chat-context';
import { WorkbookWebsocketEventDebugDialog } from './devtool/WorkbookWebsocketEventDebugDialog';

interface RecordDataToolbarProps {
  table: SnapshotTable;
}

export const RecordDataToolbar = (props: RecordDataToolbarProps) => {
  const { table } = props;
  const { workbook, clearActiveRecordFilter } = useActiveWorkbook();
  const { activeModel } = useAgentChatContext();
  const { isDevToolsEnabled } = useDevTools();
  const { mutate: globalMutate } = useSWRConfig();
  const [helpOverlayOpen, { open: openHelpOverlay, close: closeHelpOverlay }] = useDisclosure(false);
  const [workbookWSEventModalOpen, { open: openWorkbookWSEventModal, close: closeWorkbookWSEventModal }] =
    useDisclosure(false);
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

  const { count, filteredCount, records, createNewRecord } = useSnapshotTableRecords({
    workbookId: workbook?.id ?? null,
    tableId: table.id,
  });

  // Local state
  const [sqlFilterModalOpen, setSqlFilterModalOpen] = useState(false);
  const [sqlFilterText, setSqlFilterText] = useState('');
  const [sqlFilterError, setSqlFilterError] = useState<string | null>(null);

  const currentTableFilter = useMemo(() => {
    return table.activeRecordSqlFilter || undefined;
  }, [table.activeRecordSqlFilter]);

  const currentPageSize = useMemo(() => {
    return table.pageSize ?? 10; // default to 10 if not set
  }, [table.pageSize]);

  const tokenCalculation: TokenCalculation = useMemo(() => {
    if (!records || records.length === 0)
      return { tokenCount: 0, charCount: 0, method: 'empty_array', accuracy: 'exact' };
    return calculateTokensForRecords(records, activeModel?.value ?? '');
  }, [records, activeModel?.value]);

  const visibleRecordCount = useMemo(() => {
    if (!records) return 0;
    return records.length;
  }, [records]);

  const hiddenByPageSize = useMemo(() => {
    if (!filteredCount || !currentPageSize) return 0;
    return Math.max(0, filteredCount - visibleRecordCount);
  }, [filteredCount, currentPageSize, visibleRecordCount]);

  const tokenPercentage = useMemo(() => {
    if (!tokenCalculation || !activeModel || !activeModel.contextLength) return null;
    return Math.round((tokenCalculation.tokenCount / activeModel.contextLength) * 100);
  }, [tokenCalculation, activeModel]);

  const avgTokensPerRecord = useMemo(() => {
    if (!visibleRecordCount || visibleRecordCount === 0 || !tokenCalculation) return null;
    return Math.round(tokenCalculation.tokenCount / visibleRecordCount);
  }, [visibleRecordCount, tokenCalculation]);

  const maxRecordsFit = useMemo(() => {
    if (!activeModel || !activeModel.contextLength || !avgTokensPerRecord || avgTokensPerRecord === 0) return null;
    return Math.floor(activeModel.contextLength / avgTokensPerRecord);
  }, [activeModel, avgTokensPerRecord]);

  const tokenTooltipContent = useMemo(() => {
    if (!tokenCalculation) return null;

    const methodLabel =
      tokenCalculation.method === 'tiktoken'
        ? 'exact'
        : tokenCalculation.method === 'sampling'
          ? 'sampling'
          : tokenCalculation.method === 'estimate'
            ? 'word count estimate'
            : tokenCalculation.method === 'empty_array'
              ? 'empty array'
              : 'missing data';

    return (
      <Box>
        <Box mb="xs">
          <Text13Book fw={600} component="span">
            method:
          </Text13Book>{' '}
          <Text13Book component="span">{methodLabel}</Text13Book>
        </Box>
        {avgTokensPerRecord !== null && (
          <Box mb={tokenPercentage !== null && tokenPercentage > 100 ? 'xs' : undefined}>
            <Text13Book fw={600} component="span">
              avg. per record:
            </Text13Book>{' '}
            <Text13Book component="span">{formatTokenCount(avgTokensPerRecord)} tokens</Text13Book>
          </Box>
        )}
        {tokenPercentage !== null && tokenPercentage > 100 && maxRecordsFit !== null && (
          <Box>
            <Text13Book fw={600} component="span">
              100% ≈
            </Text13Book>{' '}
            <Text13Book component="span">
              {maxRecordsFit} {pluralize('record', maxRecordsFit)}
            </Text13Book>
          </Box>
        )}
      </Box>
    );
  }, [tokenCalculation, avgTokensPerRecord, tokenPercentage, maxRecordsFit]);

  useEffect(() => {
    if (sqlFilterModalOpen) {
      setSqlFilterText(currentTableFilter || '');
      setSqlFilterError(null); // Clear any previous errors
    }
  }, [sqlFilterModalOpen, currentTableFilter]);

  const handleSetSqlFilter = useCallback(async () => {
    if (!table.id || !workbook) return;

    setSqlFilterError(null); // Clear any previous errors

    try {
      await workbookApi.setActiveRecordsFilter(workbook.id, table.id, sqlFilterText || undefined);
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
  }, [table.id, workbook, sqlFilterText]);

  const handleSetPageSize = useCallback(
    async (pageSize: number | null) => {
      if (!table.id || !workbook) return;

      try {
        await workbookApi.setPageSize(workbook.id, table.id, pageSize);

        // Invalidate caches to refetch data with new page size
        globalMutate(SWR_KEYS.workbook.detail(workbook.id));
        globalMutate(SWR_KEYS.workbook.list());
        globalMutate(SWR_KEYS.workbook.recordsKeyMatcher(workbook.id, table.id), undefined, {
          revalidate: true,
        });

        ScratchpadNotifications.success({
          title: 'Page Size Updated',
          message: pageSize === null ? 'Showing all records' : `Showing ${pageSize} records per page`,
        });
      } catch (error) {
        console.error('Error setting page size:', error);
        ScratchpadNotifications.error({
          title: 'Failed to Update Page Size',
          message: error instanceof Error ? error.message : 'Failed to set page size',
        });
      }
    },
    [table.id, workbook, globalMutate],
  );

  return (
    <>
      <Group justify="flex-start" align="center" h="100%">
        <Group gap="2px">
          <ContentFooterButton leftSection={<PlusIcon size={16} />} onClick={createNewRecord}>
            Row
          </ContentFooterButton>
          <StyledIcon Icon={LineVerticalIcon} c="gray.6" size="xs" />
          <Menu>
            <Menu.Target>
              <ContentFooterButton leftSection={<FunnelSimpleIcon size={16} />}>Filter</ContentFooterButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setSqlFilterModalOpen(true)}>Set SQL Filter</Menu.Item>
              <Menu.Item disabled={!currentTableFilter} onClick={() => table.id && clearActiveRecordFilter(table.id)}>
                Clear Filter
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <StyledIcon Icon={LineVerticalIcon} c="gray.6" size="xs" />
          <Menu>
            <Menu.Target>
              <ContentFooterButton>
                {currentPageSize === null ? 'All records' : `${currentPageSize} records`}
              </ContentFooterButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Page Size</Menu.Label>
              <Menu.Item onClick={() => handleSetPageSize(10)}>10 records</Menu.Item>
              <Menu.Item onClick={() => handleSetPageSize(25)}>25 records</Menu.Item>
              <Menu.Item onClick={() => handleSetPageSize(50)}>50 records</Menu.Item>
              <Menu.Item onClick={() => handleSetPageSize(100)}>100 records</Menu.Item>
              <Menu.Item onClick={() => handleSetPageSize(500)}>500 records</Menu.Item>
              <Menu.Item onClick={() => handleSetPageSize(1000)}>1,000 records</Menu.Item>
              <Menu.Divider />
              <Menu.Item onClick={() => handleSetPageSize(null)}>All records</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Group ml="auto" gap="xs" align="center">
          {count !== undefined && (
            <>
              <Text13Book>
                {`${visibleRecordCount} ${pluralize('record', visibleRecordCount)} `}=
                {` ${formatTokenCount(tokenCalculation.charCount)} chars `}
                {tokenCalculationSymbol(tokenCalculation)}{' '}
                <Tooltip label={tokenTooltipContent} withArrow>
                  <span
                    style={{
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      cursor: 'help',
                    }}
                  >
                    {`${formatTokenCount(tokenCalculation.tokenCount)} Tokens`}
                    {tokenPercentage !== null && ` (${tokenPercentage}%)`}
                  </span>
                </Tooltip>
                {(() => {
                  const parts: string[] = [];
                  if (count > filteredCount) {
                    parts.push(`${count - filteredCount} filtered`);
                  }
                  if (hiddenByPageSize > 0) {
                    parts.push(`${hiddenByPageSize} hidden`);
                  }
                  return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
                })()}
              </Text13Book>
            </>
          )}
          {isDevToolsEnabled && (
            <ToolIconButton
              icon={BugIcon}
              onClick={openWorkbookWSEventModal}
              size="md"
              tooltip="Dev Tool: Toggle workbook event log"
            />
          )}
          <ToolIconButton icon={HelpCircleIcon} onClick={openHelpOverlay} size="md" />
        </Group>
      </Group>
      {/* SQL Filter Modal */}
      <Modal opened={sqlFilterModalOpen} onClose={() => setSqlFilterModalOpen(false)} title="Set SQL Filter" size="md">
        <Box>
          <Text12Regular>Enter a SQL WHERE clause to filter records. Leave empty to clear the filter.</Text12Regular>
          <Text12Regular size="xs" c="dimmed" mb="md">
            Example: name = &apos;John&apos; AND age &gt; 25
          </Text12Regular>
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
      <WorkbookWebsocketEventDebugDialog opened={workbookWSEventModalOpen} onClose={closeWorkbookWSEventModal} />
      <KeyboardShortcutHelpModal opened={helpOverlayOpen} onClose={closeHelpOverlay} />
    </>
  );
};
