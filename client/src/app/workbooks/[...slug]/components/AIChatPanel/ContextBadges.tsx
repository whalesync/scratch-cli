'use client';

import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { CloseButton, Group, Text, Tooltip } from '@mantine/core';
import { useMemo } from 'react';
import styles from './ContextBadges.module.css';

export const ContextBadges = () => {
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
    <ContextBadge
      label={text.label}
      tooltip={text.tooltip}
      icon={activeTable && <ConnectorIcon connector={activeTable.connectorService} size={14} p={0} />}
    />
  );
};

export const ContextBadge = ({
  label,
  tooltip,
  icon,
  onClose,
  onClick,
}: {
  label: string;
  tooltip?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
  onClick?: () => void;
}) => {
  const content = (
    <Group
      gap={4}
      wrap="nowrap"
      className={`${customBordersClasses.cornerBorders} ${styles.badge}`}
      align="center"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {icon}
      <Text fz="12px" lh={1} c="gray.9">
        {label}
      </Text>
      {onClose && (
        <CloseButton
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        />
      )}
    </Group>
  );

  if (tooltip) {
    return <Tooltip label={tooltip}>{content}</Tooltip>;
  }

  return content;
};
