'use client';

import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { CloseButton, Group, Text, Tooltip } from '@mantine/core';
import _ from 'lodash';
import { Disc3Icon, RectangleEllipsisIcon } from 'lucide-react';
import styles from './ContextBadges.module.css';

export const ContextBadges = () => {
  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();
  const { activeTable } = useActiveWorkbook();

  return (
    <Group gap="xs">
      {dataScope === 'table' && activeTable && (
        <ContextBadge
          label={_.truncate(activeTable.tableSpec?.name || 'Table', { length: 15 })}
          tooltip={`The agent can work with all visible records in the table "${activeTable?.tableSpec?.name || ''}"`}
          icon={<ConnectorIcon connector={activeTable.connectorService} size={14} p={0} />}
        />
      )}
      {dataScope === 'record' || dataScope === 'column' ? (
        <ContextBadge
          label={_.capitalize(activeRecordId || '')}
          tooltip="The agent is working on only this record"
          icon={<Disc3Icon size={12} />}
        />
      ) : null}
      {dataScope === 'column' && (
        <ContextBadge
          label={_.capitalize(activeColumnId || '')}
          icon={<RectangleEllipsisIcon size={12} />}
          tooltip="The agent is focusing on only this field"
        />
      )}
    </Group>
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
