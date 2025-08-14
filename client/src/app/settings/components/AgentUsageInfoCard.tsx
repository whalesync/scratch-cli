import { TextRegularSm, TextTitleLg } from '@/app/components/base/text';
import { useAgentTokenUsage } from '@/hooks/use-agent-usage-stats';
import { AgentUsageEvent, UsageSummary } from '@/types/server-entities/agent-usage-events';
import { Card, Center, Loader, Stack, Table, Tabs, Text } from '@mantine/core';

export const AgentUsageInfoCard = () => {
  const { events, summary, isLoading } = useAgentTokenUsage();

  return (
    <Card shadow="sm" padding="sm" radius="md" withBorder w={700}>
      <TextTitleLg mb="xs">Monthly AI Usage</TextTitleLg>
      {isLoading ? (
        <Center mih={200}>
          <Loader />
          <Text>Loading...</Text>
        </Center>
      ) : (
        <Tabs mih={200}>
          <Tabs.List>
            <Tabs.Tab value="summary">Summary</Tabs.Tab>
            <Tabs.Tab value="history">History</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="summary">
            <UsageSummaryTab summary={summary} />
          </Tabs.Panel>
          <Tabs.Panel value="history">
            <UsageEventListTab events={events} />
          </Tabs.Panel>
        </Tabs>
      )}
    </Card>
  );
};

const UsageSummaryTab = ({ summary }: { summary?: UsageSummary }) => {
  return (
    <Stack mt="md" gap="xs">
      <TextRegularSm c="dimmed">
        Total usage for the current month: {summary?.totalTokens.toLocaleString()} tokens
      </TextRegularSm>
      <Table.ScrollContainer minWidth={500} maxHeight={300} type="native">
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>By modal:</Table.Th>
              <Table.Th ta="right">Requests</Table.Th>
              <Table.Th ta="right">Tokens</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {summary?.items.map((item) => (
              <Table.Tr key={item.model}>
                <Table.Td>{item.model}</Table.Td>
                <Table.Td ta="right">{item.totalRequests.toLocaleString()}</Table.Td>
                <Table.Td ta="right">{item.totalTokens.toLocaleString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
};

const UsageEventListTab = ({ events }: { events?: AgentUsageEvent[] }) => {
  return (
    <Table.ScrollContainer minWidth={500} maxHeight={300} type="native">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Model</Table.Th>
            <Table.Th>Credentials</Table.Th>
            <Table.Th ta="right">Requests</Table.Th>
            <Table.Th ta="right">Tokens</Table.Th>
            <Table.Th>When</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {events?.map((event) => (
            <Table.Tr key={event.id}>
              <Table.Td>{event.model}</Table.Td>
              <Table.Td>{event.context?.agent_credentials}</Table.Td>
              <Table.Td ta="right">{event.requests}</Table.Td>
              <Table.Td ta="right">{event.totalTokens}</Table.Td>
              <Table.Td>{new Date(event.createdAt).toLocaleString()}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
};
