import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { Service } from '@/types/server-entities/connector-accounts';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';

interface TablePublishStatsProps {
  tableId: string;
  tableName: string;
  service: Service | null;
  newRecords: number;
  updatedRecords: number;
  deletedRecords: number;
}

export const TablePublishStats = ({
  tableName,
  service,
  newRecords,
  updatedRecords,
  deletedRecords,
}: TablePublishStatsProps) => {
  return (
    <Stack gap={0}>
      <Group
        gap="xs"
        p="md"
        style={{
          border: '0.5px solid var(--mantine-color-gray-3)',
        }}
      >
        <ConnectorIcon size={24} connector={service} />
        <Text fw={500}>{tableName}</Text>
      </Group>
      <SimpleGrid cols={3} spacing={0}>
        <Stack
          gap={4}
          align="flex-start"
          p="md"
          style={{ border: '0.5px solid var(--mantine-color-gray-3)', borderTop: 'none' }}
        >
          <Text>{newRecords}</Text>
          <Text>New records</Text>
        </Stack>

        <Stack
          gap={4}
          align="flex-start"
          p="md"
          style={{ border: '0.5px solid var(--mantine-color-gray-3)', borderLeft: 'none', borderTop: 'none' }}
        >
          <Text>{updatedRecords}</Text>
          <Text>Updated records</Text>
        </Stack>

        <Stack
          gap={4}
          align="flex-start"
          p="md"
          style={{ border: '0.5px solid var(--mantine-color-gray-3)', borderLeft: 'none', borderTop: 'none' }}
        >
          <Text>{deletedRecords}</Text>
          <Text>Deleted records</Text>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
};
