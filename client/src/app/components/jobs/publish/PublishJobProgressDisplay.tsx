import { PublishRecordsPublicProgress } from '@/app/components/jobs/publish/PublishJobProgress';
import { Badge, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { Check, Circle, Dot } from 'lucide-react';
import { FC } from 'react';
import { getStatusColor } from '../job-utils';

type Props = {
  publishProgress: PublishRecordsPublicProgress;
};

export const PublishJobProgressDisplay: FC<Props> = (props) => {
  const { publishProgress } = props;

  const getTableIndicator = (status: PublishRecordsPublicProgress['tables'][0]['status']) => {
    switch (status) {
      case 'pending':
        return (
          <ThemeIcon size="sm" variant="outline" color="gray">
            <Circle size={12} />
          </ThemeIcon>
        );
      case 'in_progress':
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
        <Text fw={500}>Total Records Published</Text>
        <Badge size="lg" color={getStatusColor()}>
          {publishProgress.totalRecordsPublished.toLocaleString()}
        </Badge>
      </Group>

      {/* Tables List */}
      <Stack gap="xs">
        <Text fw={500} size="sm">
          Tables Progress
        </Text>
        {publishProgress.tables.map((table) => (
          <Stack key={table.id} gap={4}>
            <Group justify="space-between" p="xs">
              <Group gap="sm">
                {getTableIndicator(table.status)}
                <Text size="sm" fw={500}>
                  {table.name}
                </Text>
              </Group>
              <Text size="sm" c="dimmed">
                {(table.creates + table.updates + table.deletes).toLocaleString()} records
              </Text>
            </Group>
            {table.status !== 'pending' && (
              <Group gap="md" pl="calc(var(--mantine-spacing-xs) + var(--mantine-spacing-sm) + 24px)">
                <Text size="xs" c="dimmed">
                  {table.creates} created
                </Text>
                <Text size="xs" c="dimmed">
                  {table.updates} updated
                </Text>
                <Text size="xs" c="dimmed">
                  {table.deletes} deleted
                </Text>
              </Group>
            )}
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
