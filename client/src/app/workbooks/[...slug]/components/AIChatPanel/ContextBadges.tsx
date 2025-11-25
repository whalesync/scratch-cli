'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { Group, Text, Tooltip } from '@mantine/core';
import _ from 'lodash';
import { Disc3Icon, LucideIcon, RectangleEllipsisIcon, Table2Icon } from 'lucide-react';
import styles from './ContextBadges.module.css';

export const ContextBadges = () => {
  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();
  const { activeTable } = useActiveWorkbook();

  return (
    <Group gap="xs">
      {dataScope === 'table' && (
        <ContextBadge
          label={_.capitalize(dataScope)}
          tooltip={`The agent can work with all visisble records in the table "${activeTable?.tableSpec?.name || ''}"`}
          icon={Table2Icon}
        />
      )}
      {dataScope === 'record' || dataScope === 'column' ? (
        <ContextBadge
          label={_.capitalize(activeRecordId || '')}
          tooltip="The agent is working on only this record"
          icon={Disc3Icon}
        />
      ) : null}
      {dataScope === 'column' && (
        <ContextBadge
          label={_.capitalize(activeColumnId || '')}
          icon={RectangleEllipsisIcon}
          tooltip="The agent is focusing on only this field"
        />
      )}
    </Group>
  );
};

const ContextBadge = ({ label, tooltip, icon }: { label: string; tooltip?: string; icon: LucideIcon }) => {
  return (
    <Tooltip label={tooltip || ''}>
      <Group px="4px" py="2px" gap="2xs" wrap="nowrap" className={styles.badge} align="center">
        <StyledLucideIcon Icon={icon} size={12} />
        <Text fz="12px" lh={1}>
          {label}
        </Text>
      </Group>
    </Tooltip>
  );
};
