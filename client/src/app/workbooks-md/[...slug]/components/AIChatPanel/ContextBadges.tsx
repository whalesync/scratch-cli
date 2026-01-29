'use client';

import { CornerBoxedBadge } from '@/app/components/CornerBoxedBadge';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { useAgentChatContext } from '@/app/workbooks-md/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { SnapshotTable } from '@spinner/shared-types';
import { useMemo } from 'react';
import { FileContextBadges } from './FileContextBadges';

const DataContextBadges = () => {
  const { activeTable: activeSnapshotTable } = useActiveWorkbook();

  const activeTable = activeSnapshotTable as SnapshotTable;

  const { dataScope, activeColumnId } = useAgentChatContext();

  const text = useMemo(() => {
    if (!activeTable) {
      return null;
    }

    switch (dataScope) {
      case 'table':
        return {
          label: activeTable?.tableSpec?.name || 'Table',
          tooltip: `The agent can work with all visible records in the table "${activeTable?.tableSpec?.name || ''}"`,
        };
      case 'column':
        return {
          label: activeColumnId ?? 'Column',
          tooltip: `The agent is focusing on only this field`,
        };
    }
  }, [dataScope, activeTable, activeColumnId]);

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
