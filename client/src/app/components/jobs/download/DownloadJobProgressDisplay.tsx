import { DownloadProgress, TableProgress } from '@/app/components/jobs/download/DownloadJobProgress';
import { Badge, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { Check, Circle, Dot } from 'lucide-react';
import { FC } from 'react';
import { getStatusColor } from '../job-utils';

type Props = {
  downloadProgress: DownloadProgress;
};
export const DownloadJobProgressDisplay: FC<Props> = (props) => {
  const { downloadProgress } = props;

  const getTableIndicator = (status: TableProgress['status']) => {
    switch (status) {
      case 'pending':
        return (
          <ThemeIcon size="sm" variant="outline" color="gray">
            <Circle size={12} />
          </ThemeIcon>
        );
      case 'active':
        return (
          <ThemeIcon size="sm" color="blue">
            <Dot size={12} />
          </ThemeIcon>
        );
      case 'completed':
        return (
          <ThemeIcon size="sm" color="green">
            <Check size={12} />
          </ThemeIcon>
        );
      case 'failed':
        return (
          <ThemeIcon size="sm" color="red">
            <Circle size={12} />
          </ThemeIcon>
        );
      default:
        return (
          <ThemeIcon size="sm" variant="outline" color="gray">
            <Circle size={12} />
          </ThemeIcon>
        );
    }
  };

  return (
    <Stack gap="sm">
      {/* Total Records */}
      <Group justify="space-between">
        <Text fw={500}>Total Records Downloaded</Text>
        <Badge size="lg" color={getStatusColor()}>
          {downloadProgress.totalRecords.toLocaleString()}
        </Badge>
      </Group>

      {/* Tables List */}
      <Stack gap="xs">
        <Text fw={500} size="sm">
          Tables Progress
        </Text>
        {downloadProgress.tables.map((table) => (
          <Group
            key={table.id}
            justify="space-between"
            p="xs"
            // style={{
            //   backgroundColor: 'var(--mantine-color-gray-0)',
            //   borderRadius: 'var(--mantine-radius-sm)',
            // }}
          >
            <Group gap="sm">
              {getTableIndicator(table.status)}
              <Text size="sm" fw={500}>
                {table.name}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {table.records.toLocaleString()} records
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
};
