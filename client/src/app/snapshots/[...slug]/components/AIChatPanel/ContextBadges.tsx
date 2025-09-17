'use client';

import { TextRegularXs } from '@/app/components/base/text';
import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { TableSpec } from '@/types/server-entities/snapshot';
import { ColumnView } from '@/types/server-entities/view';
import { Group, Tooltip } from '@mantine/core';
import { BinocularsIcon, EyeIcon, Icon, TableIcon, TagSimpleIcon, VinylRecordIcon } from '@phosphor-icons/react';
import _ from 'lodash';
import styles from './ContextBadges.module.css';

export const ContextBadges = ({
  activeTable,
  currentView,
}: {
  activeTable: TableSpec | null;
  currentView: ColumnView | undefined;
}) => {
  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();

  return (
    <Group gap="xs">
      <Group gap="xs">
        {activeTable && (
          <ContextBadge label={activeTable.name} tooltip="The current table being viewed" icon={TableIcon} />
        )}
        {dataScope && (
          <ContextBadge
            label={_.capitalize(dataScope)}
            tooltip="The agent can work all active records in the table"
            icon={BinocularsIcon}
          />
        )}
        {dataScope === 'record' || dataScope === 'column' ? (
          <ContextBadge
            label={_.capitalize(activeRecordId || '')}
            tooltip="The agent is just working on this record"
            icon={VinylRecordIcon}
          />
        ) : null}
        {dataScope === 'column' && (
          <ContextBadge
            label={_.capitalize(activeColumnId || '')}
            icon={TagSimpleIcon}
            tooltip="The agent is focusing on this column"
          />
        )}
        {currentView && (
          <ContextBadge
            label={_.capitalize(currentView.name || currentView.id)}
            icon={EyeIcon}
            tooltip="The active column view used by the agent"
          />
        )}
      </Group>
    </Group>
  );
};

export const ContextBadge = ({
  label,
  tooltip,
  icon,
  color,
}: {
  label: string;
  tooltip?: string;
  icon: Icon;
  color?: string;
}) => {
  return (
    <Tooltip label={tooltip || ''}>
      <Group px="4px" py="2px" gap="2xs" wrap="nowrap" className={styles.badge}>
        <StyledIcon Icon={icon} size={14} c={color || 'gray.6'} />
        <TextRegularXs>{label}</TextRegularXs>
      </Group>
    </Tooltip>
  );
};
