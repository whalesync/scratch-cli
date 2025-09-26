'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { TableSpec } from '@/types/server-entities/snapshot';
import { ColumnView } from '@/types/server-entities/view';
import { Group, Text, Tooltip } from '@mantine/core';
import { Icon } from '@phosphor-icons/react';
import _ from 'lodash';
import { Disc3Icon, RectangleEllipsisIcon, Table2Icon, ViewIcon } from 'lucide-react';
import styles from './ContextBadges.module.css';

export const ContextBadges = ({
  currentView,
}: {
  activeTable: TableSpec | null;
  currentView: ColumnView | undefined;
}) => {
  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();

  return (
    <Group gap="xs">
      {/* {activeTable && (
          <ContextBadge label={activeTable.name} tooltip="The current table being viewed" icon={Table2Icon} />
        )} */}
      {dataScope === 'table' && (
        <ContextBadge
          label={_.capitalize(dataScope)}
          tooltip="The agent can work all active records in the table"
          icon={Table2Icon}
        />
      )}
      {dataScope === 'record' || dataScope === 'column' ? (
        <ContextBadge
          label={_.capitalize(activeRecordId || '')}
          tooltip="The agent is just working on this record"
          icon={Disc3Icon}
        />
      ) : null}
      {dataScope === 'column' && (
        <ContextBadge
          label={_.capitalize(activeColumnId || '')}
          icon={RectangleEllipsisIcon}
          tooltip="The agent is focusing on this field"
        />
      )}
      {currentView && (
        <ContextBadge
          label={_.capitalize(currentView.name || currentView.id)}
          icon={ViewIcon}
          tooltip="The active column view used by the agent"
        />
      )}
    </Group>
  );
};

export const ContextBadge = ({ label, tooltip, icon }: { label: string; tooltip?: string; icon: Icon }) => {
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
