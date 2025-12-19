import { SnapshotTable } from '@spinner/shared-types';
import { DocsUrls } from '@/utils/docs-urls';
import { Anchor, Divider, Popover, Stack } from '@mantine/core';
import { CircleAlert } from 'lucide-react';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useSnapshotTableRecords } from '../../../../../hooks/use-snapshot-table-records';
import { formatTokenCount, TokenUsageStats, tokenUsageStats } from '../../../../../utils/token-counter';
import { ButtonSecondaryInline } from '../../../../components/base/buttons';
import { Text13Regular } from '../../../../components/base/text';
import { CircularProgress } from '../../../../components/CircularProgress';
import { DevToolPopover } from '../../../../components/DevToolPopover';
import { StyledLucideIcon } from '../../../../components/Icons/StyledLucideIcon';
import { useAgentChatContext } from '../contexts/agent-chat-context';

export const TokenUseButton = ({ table }: { table: SnapshotTable }) => {
  const { activeModel } = useAgentChatContext();

  const { records } = useSnapshotTableRecords({
    workbookId: table.workbookId,
    tableId: table.id,
  });

  const stats: TokenUsageStats | null = useMemo(() => {
    if (!activeModel || !table || records === undefined) {
      return null;
    }
    return tokenUsageStats(activeModel, table, records);
  }, [activeModel, table, records]);

  if (!stats) {
    return null;
  }

  const icon =
    (stats.usagePercentage ?? 0) >= 100 ? (
      <StyledLucideIcon Icon={CircleAlert} size={12} c="red" />
    ) : (
      <CircularProgress fraction={stats.usagePercentage ? stats.usagePercentage / 100 : 0} minFraction={0.1} />
    );

  return (
    <Popover width="auto">
      <Popover.Target>
        <ButtonSecondaryInline leftSection={icon} style={{ flexShrink: 0 }}>
          <Text13Regular>{`${stats.usagePercentage ?? '-'}%`}</Text13Regular>
        </ButtonSecondaryInline>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text13Regular c="var(--fg-secondary)">
            {stats.visibleRecords} {pluralize('row', stats.visibleRecords)} and {stats.visibleColumns}{' '}
            {pluralize('column', stats.visibleColumns)} in context
          </Text13Regular>
          <Text13Regular c="var(--fg-secondary)">= {formatTokenCount(stats.tokens.charCount)} characters</Text13Regular>
          <Text13Regular c="var(--fg-secondary)">
            = {formatTokenCount(stats.tokens.tokenCount)} of{' '}
            {stats.modelMaxTokens ? formatTokenCount(stats.modelMaxTokens) : '-'} tokens
          </Text13Regular>
          <Text13Regular>= {stats.usagePercentage ?? '-'}% of context used</Text13Regular>

          <DevToolPopover>
            <Text13Regular>Method: {stats.tokens.method}</Text13Regular>
            <Text13Regular>Accuracy: {stats.tokens.accuracy}</Text13Regular>
            <Text13Regular>Max tokens: {stats.modelMaxTokens}</Text13Regular>
            <Text13Regular>Avg. per record: {stats.avgTokensPerRecord}</Text13Regular>
            <Text13Regular>Max records fit: {stats.maxRecordsFit}</Text13Regular>
          </DevToolPopover>

          <Divider mx={'-xs'} />
          <Anchor href={DocsUrls.howDoesTokenContextWork} target="_blank" c="var(--fg-secondary)">
            How to reduce tokens in context
          </Anchor>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};
