import { SnapshotTable } from '@/types/server-entities/workbook';
import { Box, Tooltip } from '@mantine/core';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useSnapshotTableRecords } from '../../../../../../../hooks/use-snapshot-table-records';
import {
  calculateTokensForRecords,
  formatTokenCount,
  TokenCalculation,
  tokenCalculationSymbol,
} from '../../../../../../../utils/token-counter';
import { Text13Book } from '../../../../../../components/base/text';
import { useAgentChatContext } from '../../../contexts/agent-chat-context';

export const TokenUseFooterButton = ({ table }: { table: SnapshotTable }) => {
  const { activeModel } = useAgentChatContext();

  const { count, filteredCount, records } = useSnapshotTableRecords({
    workbookId: table.workbookId,
    tableId: table.id,
  });

  const tokenCalculation: TokenCalculation = useMemo(() => {
    if (!records || records.length === 0)
      return { tokenCount: 0, charCount: 0, method: 'empty_array', accuracy: 'exact' };
    return calculateTokensForRecords(records, activeModel?.value ?? '');
  }, [records, activeModel?.value]);

  const visibleRecordCount = useMemo(() => {
    if (!records) return 0;
    return records.length;
  }, [records]);

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

  const hiddenByPageSize = useMemo(() => {
    if (!filteredCount || !table.pageSize) return 0;
    return Math.max(0, filteredCount - visibleRecordCount);
  }, [filteredCount, table.pageSize, visibleRecordCount]);

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

  if (count === undefined) {
    return null;
  }

  return (
    <Text13Book lh="24px" px={4}>
      {`${visibleRecordCount} ${pluralize('record', visibleRecordCount)} `}=
      {` ${formatTokenCount(tokenCalculation.charCount)} chars `}
      {tokenCalculationSymbol(tokenCalculation)}
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
  );
};
