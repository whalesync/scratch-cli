'use client';

import { CornerBoxedBadge } from '@/app/components/CornerBoxedBadge';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { useMemo } from 'react';
import { FileContextBadges } from './FileContextBadges';

const DataContextBadges = () => {
  const { activeTable } = useActiveWorkbook();

  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();
  const { records } = useSnapshotTableRecords({
    workbookId: activeTable?.workbookId ?? null,
    tableId: activeTable?.id ?? null,
  });

  const text = useMemo(() => {
    if (!activeTable) {
      return null;
    }

    const activeRecord = activeRecordId ? records?.find((r) => r.id.wsId === activeRecordId) : null;

    switch (dataScope) {
      case 'table':
        return {
          label: activeTable?.tableSpec?.name || 'Table',
          tooltip: `The agent can work with all visible records in the table "${activeTable?.tableSpec?.name || ''}"`,
        };
      case 'record':
        return {
          label: activeRecord?.id.remoteId ?? 'Record',
          tooltip: `The agent is focusing on only this record`,
        };
      case 'column':
        return {
          label: activeColumnId ?? 'Column',
          tooltip: `The agent is focusing on only this field`,
        };
    }
  }, [dataScope, activeTable, activeRecordId, activeColumnId, records]);

  if (!text) {
    return null;
  }
  return (
    <CornerBoxedBadge
      label={text.label}
      tooltip={text.tooltip}
      icon={activeTable && <ConnectorIcon connector={activeTable.connectorService} size={14} p={0} />}
    />
  );
};

export const ContextBadges = () => {
  const { agentType } = useAgentChatContext();

  if (agentType === 'file') {
    return <FileContextBadges />;
  }

  return <DataContextBadges />;
};
