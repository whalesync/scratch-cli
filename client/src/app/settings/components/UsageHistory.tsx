import { TextTitleLg } from '@/app/components/base/text';
import { useAgentTokenUsage } from '@/hooks/use-agent-usage-stats';
import { Card, Center, Loader, Stack, Table, Text } from '@mantine/core';

export const UsageHistory = () => {
  const { events, isLoading } = useAgentTokenUsage();

  const content = isLoading ? (
    <Center mih={200}>
      <Loader />
      <Text>Loading...</Text>
    </Center>
  ) : (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Model</Table.Th>
          <Table.Th>Credentials</Table.Th>
          <Table.Th>Requests</Table.Th>
          <Table.Th>Tokens</Table.Th>
          <Table.Th>When</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody mah={100} style={{ overflowY: 'auto' }}>
        {events?.map((event) => (
          <Table.Tr key={event.id}>
            <Table.Td>{event.model}</Table.Td>
            <Table.Td>{event.context?.agent_credentials}</Table.Td>
            <Table.Td align="right">{event.requests}</Table.Td>
            <Table.Td align="right">{event.totalTokens}</Table.Td>
            <Table.Td>{new Date(event.createdAt).toLocaleString()}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );

  return (
    <Card shadow="sm" padding="sm" radius="md" withBorder>
      <TextTitleLg mb="xs">Recent AI Usage</TextTitleLg>

      <Stack gap="xs" mb="sm" mih={200}>
        {content}
      </Stack>
    </Card>
  );
};
