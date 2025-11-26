import { FC } from 'react';
import { TableIndicator } from './components/base-avatar-with-indicator';

import { getServiceName } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { Badge, Text } from '@mantine/core';
import { ConnectorIcon } from '../../ConnectorIcon';
import { getStatusColor, getStatusText } from '../job-utils';
import { TableStatus } from '../publish/PublishJobProgress';
import { SyncDirectedFlowLine } from './components/sync-direction-flow-line';
import { SyncStatusLayout } from './layout/sync-status-layout';

// This component instantiates and passes the SyncStatus micro components to the SyncStatusLayout slots.

type Props = {
  tableName: string;
  connector: string;
  doneCount: number;
  totalCount?: number;
  status: TableStatus;
  direction?: 'left' | 'right';
};

const getBadgeColor = (status: TableStatus) => {
  switch (status) {
    case 'in_progress':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'canceled':
      return 'yellow';
    case 'pending':
    default:
      return 'gray';
  }
};

export const SyncStatus: FC<Props> = (props) => {
  const { tableName, connector, doneCount, totalCount, status, direction = 'right' } = props;
  const badgeColor = getBadgeColor(status);
  const isMoving = status === 'in_progress';
  const maxCharacters = 20;
  const truncatedTableName =
    tableName.length > maxCharacters ? `${tableName.slice(0, maxCharacters - 3)}...` : tableName;

  return (
    <SyncStatusLayout
      // Top slots
      leftIcon={<TableIndicator />}
      leftFlowLine={<SyncDirectedFlowLine direction={direction} moving={isMoving} />}
      centerIcon={
        <Badge size="lg" mx="4px" variant="light" color={badgeColor}>
          <Text fw={500}>
            {direction === 'left' && '← '}
            {totalCount !== undefined ? `${doneCount}/${totalCount}` : `${doneCount}`}
            {direction === 'right' && ' →'}
          </Text>
        </Badge>
      }
      rightFlowLine={<SyncDirectedFlowLine direction={direction} moving={isMoving} />}
      rightIcon={<ConnectorIcon connector={connector} />}
      // Bottom slots
      bottomLeftSlot={<>{truncatedTableName}</>}
      bottomCenterSlot={
        <Text c={getStatusColor(status)} fw={500}>
          {getStatusText(status)}
        </Text>
      }
      bottomRightSlot={<>{getServiceName(connector as Service)}</>}
    />
  );
};
