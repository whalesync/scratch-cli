'use client';

import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { Group, Text, Tooltip } from '@mantine/core';
import { Icon } from '@phosphor-icons/react';
import _ from 'lodash';
import { Disc3Icon, RectangleEllipsisIcon, Table2Icon } from 'lucide-react';
import styles from './ContextBadges.module.css';

export const ContextBadges = () => {
  const { dataScope, activeRecordId, activeColumnId } = useAgentChatContext();

  return (
    <Group gap="xs">
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
